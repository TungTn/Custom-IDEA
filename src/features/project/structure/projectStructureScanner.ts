import { invoke } from '@tauri-apps/api/core';
import { 
  ModuleItem, 
  LibraryItem, 
  FacetItem, 
  ArtifactItem, 
  SdkItem, 
  GlobalLibraryItem 
} from './types';

export interface ScannedProjectStructure {
  projectName: string;
  projectSdk: string;
  projectLangLevel: string;
  compilerOutput: string;
  modules: ModuleItem[];
  libraries: LibraryItem[];
  facets: FacetItem[];
  artifacts: ArtifactItem[];
  sdks: SdkItem[];
  globalLibraries: GlobalLibraryItem[];
}

export async function scanProjectStructure(projectPath: string): Promise<ScannedProjectStructure | null> {
  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
  if (!isTauri || !projectPath) return null;

  const sep = projectPath.includes('/') ? '/' : '\\';
  const cleanPath = projectPath.replace(/[/\\]+$/, '');
  const dirName = cleanPath.split(/[/\\]/).pop() || 'project';

  // 1. Try scanning Maven project (pom.xml)
  try {
    const pomContent = await invoke<string>('read_file_content', { path: `${cleanPath}${sep}pom.xml` })
      .catch(() => invoke<string>('read_file_content', { path: `${cleanPath}/pom.xml` }));

    if (pomContent && pomContent.trim().length > 0) {
      return parseMavenProjectStructure(cleanPath, dirName, pomContent, sep);
    }
  } catch (_) {}

  // 2. Try scanning Node / Web project (package.json)
  try {
    const pkgContent = await invoke<string>('read_file_content', { path: `${cleanPath}${sep}package.json` })
      .catch(() => invoke<string>('read_file_content', { path: `${cleanPath}/package.json` }));

    if (pkgContent && pkgContent.trim().length > 0) {
      return parseNodeProjectStructure(cleanPath, dirName, pkgContent, sep);
    }
  } catch (_) {}

  // 3. Try scanning Rust project (Cargo.toml)
  try {
    const cargoContent = await invoke<string>('read_file_content', { path: `${cleanPath}${sep}Cargo.toml` })
      .catch(() => invoke<string>('read_file_content', { path: `${cleanPath}/Cargo.toml` }));

    if (cargoContent && cargoContent.trim().length > 0) {
      return parseRustProjectStructure(cleanPath, dirName, cargoContent, sep);
    }
  } catch (_) {}

  return null;
}

function parseMavenProjectStructure(
  projectPath: string, 
  dirName: string, 
  pomContent: string, 
  sep: string
): ScannedProjectStructure {
  // Extract artifactId / name
  const artMatch = pomContent.match(/<artifactId>([^<]+)<\/artifactId>/);
  const nameMatch = pomContent.match(/<name>([^<]+)<\/name>/);
  const projectName = artMatch?.[1] || nameMatch?.[1] || dirName;

  // Extract Java version
  const javaVerMatch = 
    pomContent.match(/<java\.version>([^<]+)<\/java\.version>/) ||
    pomContent.match(/<maven\.compiler\.source>([^<]+)<\/maven\.compiler\.source>/) ||
    pomContent.match(/<maven\.compiler\.release>([^<]+)<\/maven\.compiler\.release>/);
  
  const javaVersion = javaVerMatch?.[1]?.trim() || '21';
  const projectSdk = `Java JDK ${javaVersion} (Adoptium Temurin)`;
  const projectLangLevel = `${javaVersion} - Language Features`;
  const compilerOutput = `${projectPath}${sep}target${sep}classes`;

  // Parse Submodules
  const submodules: string[] = [];
  const modRegex = /<module>([^<]+)<\/module>/g;
  let mMatch;
  while ((mMatch = modRegex.exec(pomContent)) !== null) {
    submodules.push(mMatch[1].trim());
  }

  // Parse Dependencies
  const libraries: LibraryItem[] = [];
  const moduleDependencies: { name: string; version: string; scope: 'Compile' | 'Test' | 'Runtime' | 'Provided'; exported: boolean }[] = [];
  const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
  let dMatch;

  while ((dMatch = depRegex.exec(pomContent)) !== null) {
    const block = dMatch[1];
    const g = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1]?.trim() || '';
    const a = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1]?.trim() || '';
    const v = block.match(/<version>([^<]+)<\/version>/)?.[1]?.trim() || 'managed';
    const s = block.match(/<scope>([^<]+)<\/scope>/)?.[1]?.trim()?.toLowerCase() || 'compile';

    if (g && a) {
      let scope: 'Compile' | 'Test' | 'Runtime' | 'Provided' = 'Compile';
      if (s === 'test') scope = 'Test';
      else if (s === 'runtime') scope = 'Runtime';
      else if (s === 'provided') scope = 'Provided';

      libraries.push({
        id: `lib-mvn-${g}-${a}`,
        name: `${g}:${a}`,
        version: v,
        type: 'Maven Dependency',
        location: `~/.m2/repository/${g.replace(/\./g, '/')}/${a}/${v}`,
        usedIn: [projectName],
      });

      moduleDependencies.push({
        name: `${a}`,
        version: v,
        scope,
        exported: scope === 'Compile',
      });
    }
  }

  // Parse Modules
  const modules: ModuleItem[] = [
    {
      id: `mod-${projectName}`,
      name: projectName,
      type: 'Java / Maven Module',
      path: projectPath,
      sources: [`src${sep}main${sep}java`],
      tests: [`src${sep}test${sep}java`],
      resources: [`src${sep}main${sep}resources`],
      excluded: ['target', '.idea', '.mvn'],
      dependencies: [
        { name: `<Project SDK: ${projectSdk}>`, version: javaVersion, scope: 'Compile', exported: false },
        ...moduleDependencies,
      ],
    }
  ];

  // Add child modules if any
  for (const sub of submodules) {
    modules.push({
      id: `mod-${sub}`,
      name: sub,
      type: 'Maven Submodule',
      path: `${projectPath}${sep}${sub}`,
      sources: [`${sub}${sep}src${sep}main${sep}java`],
      tests: [`${sub}${sep}src${sep}test${sep}java`],
      resources: [`${sub}${sep}src${sep}main${sep}resources`],
      excluded: [`${sub}${sep}target`],
      dependencies: [{ name: `<Project SDK: ${projectSdk}>`, version: javaVersion, scope: 'Compile', exported: false }],
    });
  }

  // Detect Facets
  const facets: FacetItem[] = [
    {
      id: 'fac-maven',
      name: 'Maven Build System',
      type: 'Maven',
      module: projectName,
      configFile: 'pom.xml',
      description: 'Standard declarative Apache Maven lifecycle, Surefire tests, and JAR packaging.',
    }
  ];

  const pomLower = pomContent.toLowerCase();
  if (pomLower.includes('spring-boot')) {
    facets.push({
      id: 'fac-spring-boot',
      name: 'Spring Boot Application',
      type: 'Spring Framework',
      module: projectName,
      configFile: 'src/main/resources/application.yml',
      description: 'Spring Boot REST microservice with autoconfiguration, actuator, and dependency injection.',
    });
  }
  if (pomLower.includes('lombok')) {
    facets.push({
      id: 'fac-lombok',
      name: 'Project Lombok',
      type: 'Annotation Processor',
      module: projectName,
      configFile: 'pom.xml',
      description: 'Compile-time bytecode generator for getters, setters, builders, and loggers.',
    });
  }
  if (pomLower.includes('hibernate') || pomLower.includes('jpa') || pomLower.includes('mysql') || pomLower.includes('postgres') || pomLower.includes('oracle')) {
    facets.push({
      id: 'fac-jpa',
      name: 'JPA & Hibernate ORM',
      type: 'Data Persistence',
      module: projectName,
      configFile: 'pom.xml',
      description: 'Object-Relational Mapping entity persistence with Spring Data repositories.',
    });
  }

  // Artifacts
  const artifacts: ArtifactItem[] = [
    {
      id: `art-${projectName}-jar`,
      name: `${projectName}:jar`,
      type: 'Native Executable',
      outputDirectory: `${projectPath}${sep}target${sep}${projectName}.jar`,
      includeInBuild: true,
    }
  ];

  // SDKs
  const sdks: SdkItem[] = [
    {
      id: 'sdk-java-main',
      name: projectSdk,
      version: javaVersion,
      type: 'Java',
      homePath: 'C:\\Program Files\\Java',
      binaries: ['javac.exe', 'java.exe', 'jar.exe'],
    },
    {
      id: 'sdk-maven',
      name: 'Apache Maven 3.9.x',
      version: '3.9.x',
      type: 'Java',
      homePath: '~/.m2',
      binaries: ['mvn.cmd', 'mvn'],
    }
  ];

  // Global Libraries
  const globalLibraries: GlobalLibraryItem[] = [
    { name: 'Maven Local Repository (~/.m2)', path: '~/.m2/repository', size: `${libraries.length} artifacts` },
  ];

  return {
    projectName,
    projectSdk,
    projectLangLevel,
    compilerOutput,
    modules,
    libraries,
    facets,
    artifacts,
    sdks,
    globalLibraries,
  };
}

function parseNodeProjectStructure(
  projectPath: string, 
  dirName: string, 
  pkgContent: string, 
  sep: string
): ScannedProjectStructure {
  let pkg: any = {};
  try {
    pkg = JSON.parse(pkgContent);
  } catch (_) {}

  const projectName = pkg.name || dirName;
  const projectSdk = 'Node.js LTS (v22.x)';
  const projectLangLevel = 'TypeScript 5.x / ES2023';
  const compilerOutput = `${projectPath}${sep}dist`;

  const libraries: LibraryItem[] = [];
  const moduleDependencies: { name: string; version: string; scope: 'Compile' | 'Test' | 'Runtime' | 'Provided'; exported: boolean }[] = [];

  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};

  Object.entries(deps).forEach(([k, v]) => {
    libraries.push({
      id: `lib-npm-${k}`,
      name: k,
      version: String(v),
      type: 'NPM Package',
      location: `node_modules/${k}`,
      usedIn: [projectName],
    });
    moduleDependencies.push({
      name: k,
      version: String(v),
      scope: 'Compile',
      exported: true,
    });
  });

  Object.entries(devDeps).forEach(([k, v]) => {
    const isTest = k.includes('test') || k.includes('jest') || k.includes('vitest');
    libraries.push({
      id: `lib-npm-dev-${k}`,
      name: k,
      version: String(v),
      type: 'NPM Package',
      location: `node_modules/${k}`,
      usedIn: [projectName],
    });
    moduleDependencies.push({
      name: k,
      version: String(v),
      scope: isTest ? 'Test' : 'Provided',
      exported: false,
    });
  });

  const modules: ModuleItem[] = [
    {
      id: `mod-${projectName}`,
      name: projectName,
      type: 'Node.js / TypeScript Module',
      path: projectPath,
      sources: ['src'],
      tests: ['tests', 'src/__tests__'],
      resources: ['public', 'assets'],
      excluded: ['node_modules', 'dist', '.git'],
      dependencies: moduleDependencies,
    }
  ];

  const facets: FacetItem[] = [
    {
      id: 'fac-npm',
      name: 'Node.js Package Manager',
      type: 'Node.js',
      module: projectName,
      configFile: 'package.json',
      description: 'NPM package management and module resolution.',
    }
  ];

  if (pkg.dependencies?.react || pkg.devDependencies?.react) {
    facets.push({
      id: 'fac-react',
      name: 'React 18',
      type: 'Frontend Framework',
      module: projectName,
      configFile: 'vite.config.ts',
      description: 'Component-based reactive UI library.',
    });
  }

  const artifacts: ArtifactItem[] = [
    {
      id: `art-${projectName}-dist`,
      name: `${projectName}:web-dist`,
      type: 'Web Distribution Bundle',
      outputDirectory: `${projectPath}${sep}dist`,
      includeInBuild: true,
    }
  ];

  const sdks: SdkItem[] = [
    {
      id: 'sdk-node',
      name: 'Node.js LTS (v22.x)',
      version: 'v22.x',
      type: 'Node.js',
      homePath: 'C:\\Program Files\\nodejs',
      binaries: ['node.exe', 'npm.cmd', 'npx.cmd'],
    }
  ];

  const globalLibraries: GlobalLibraryItem[] = [
    { name: 'NPM Global Modules', path: '~/AppData/Roaming/npm/node_modules', size: `${libraries.length} packages` },
  ];

  return {
    projectName,
    projectSdk,
    projectLangLevel,
    compilerOutput,
    modules,
    libraries,
    facets,
    artifacts,
    sdks,
    globalLibraries,
  };
}

function parseRustProjectStructure(
  projectPath: string, 
  dirName: string, 
  cargoContent: string, 
  sep: string
): ScannedProjectStructure {
  const nameMatch = cargoContent.match(/name\s*=\s*["']([^"']+)["']/);
  const projectName = nameMatch?.[1] || dirName;
  const projectSdk = 'Rust (Stable Toolchain)';
  const projectLangLevel = 'Rust Edition 2021 (Default)';
  const compilerOutput = `${projectPath}${sep}target${sep}debug`;

  const libraries: LibraryItem[] = [];
  const depMatches = cargoContent.match(/\[dependencies\]([\s\S]*?)(?=\n\[|$)/);
  if (depMatches) {
    const lines = depMatches[1].split('\n');
    for (const l of lines) {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.*)/);
      if (m) {
        libraries.push({
          id: `lib-cargo-${m[1]}`,
          name: m[1],
          version: m[2].replace(/[{}"]/g, '').trim(),
          type: 'Cargo Crate',
          location: `~/.cargo/registry/cache`,
          usedIn: [projectName],
        });
      }
    }
  }

  const modules: ModuleItem[] = [
    {
      id: `mod-${projectName}`,
      name: projectName,
      type: 'Rust Crate',
      path: projectPath,
      sources: ['src'],
      tests: ['tests'],
      resources: [],
      excluded: ['target', '.git'],
      dependencies: libraries.map(l => ({ name: l.name, version: l.version, scope: 'Compile', exported: true })),
    }
  ];

  const facets: FacetItem[] = [
    {
      id: 'fac-cargo',
      name: 'Cargo Build System',
      type: 'Cargo',
      module: projectName,
      configFile: 'Cargo.toml',
      description: 'Rust package manager and compiler runner.',
    }
  ];

  const artifacts: ArtifactItem[] = [
    {
      id: `art-${projectName}-exe`,
      name: `${projectName}:exe`,
      type: 'Native Executable',
      outputDirectory: `${projectPath}${sep}target${sep}release${sep}${projectName}.exe`,
      includeInBuild: true,
    }
  ];

  const sdks: SdkItem[] = [
    {
      id: 'sdk-rust',
      name: 'Rust Stable',
      version: '1.x',
      type: 'Rust',
      homePath: '~/.rustup/toolchains',
      binaries: ['rustc.exe', 'cargo.exe'],
    }
  ];

  const globalLibraries: GlobalLibraryItem[] = [
    { name: 'Cargo Registry Cache', path: '~/.cargo/registry', size: `${libraries.length} crates` },
  ];

  return {
    projectName,
    projectSdk,
    projectLangLevel,
    compilerOutput,
    modules,
    libraries,
    facets,
    artifacts,
    sdks,
    globalLibraries,
  };
}
