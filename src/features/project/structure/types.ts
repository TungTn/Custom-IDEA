export interface ProjectStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectPath?: string;
  files?: any[];
  problems?: any[];
  onSave: (newName: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export type SectionId = 
  | 'project' 
  | 'modules' 
  | 'libraries' 
  | 'facets' 
  | 'artifacts' 
  | 'sdks' 
  | 'global-libraries' 
  | 'problems';

export interface ModuleItem {
  id: string;
  name: string;
  type: string;
  path: string;
  sources: string[];
  tests: string[];
  resources: string[];
  excluded: string[];
  dependencies: { name: string; version: string; scope: 'Compile' | 'Test' | 'Runtime' | 'Provided'; exported: boolean }[];
}

export interface LibraryItem {
  id: string;
  name: string;
  version: string;
  type: 'Cargo Crate' | 'NPM Package' | 'Standard Library' | 'PyPI Module' | 'Go Module' | 'Maven Dependency';
  location: string;
  usedIn: string[];
}

export interface FacetItem {
  id: string;
  name: string;
  type: string;
  module: string;
  configFile: string;
  description: string;
}

export interface ArtifactItem {
  id: string;
  name: string;
  type: 'NSIS Setup Installer' | 'MSI Package' | 'Native Executable' | 'Web Distribution Bundle';
  outputDirectory: string;
  includeInBuild: boolean;
}

export interface SdkItem {
  id: string;
  name: string;
  version: string;
  type: 'Rust' | 'Node.js' | 'Java' | 'Python' | 'Go' | 'C/C++' | 'Docker';
  homePath: string;
  binaries: string[];
}

export interface ProblemItem {
  id: string;
  severity: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  fixAction: string;
  fixed?: boolean;
}

export interface GlobalLibraryItem {
  name: string;
  path: string;
  size: string;
}

export const LANGUAGE_LEVELS: Record<string, string[]> = {
  'Rust': [
    'Rust Edition 2024 (Preview)',
    'Rust Edition 2021 (Default)',
    'Rust Edition 2018',
    'Rust Edition 2015'
  ],
  'Node.js': [
    'TypeScript 5.6 (ES2023)',
    'TypeScript 5.4 (ES2022)',
    'JavaScript ESNext',
    'JavaScript ES6'
  ],
  'Java': [
    '21 - Virtual Threads, Pattern Matching',
    '17 LTS - Sealed Classes, Records',
    '11 LTS - Local-Variable Syntax for Lambda',
    '8 - Lambdas, Type Annotations'
  ],
  'Python': [
    'Python 3.12 (Type Parameter Syntax)',
    'Python 3.11 (Exception Groups, TaskGroup)',
    'Python 3.10 (Structural Pattern Matching)',
    'Python 3.9'
  ],
  'Go': [
    'Go 1.22 (Range over integers, Enhanced routing)',
    'Go 1.21 (Built-in min, max, clear)',
    'Go 1.20'
  ],
  'C/C++': [
    'C++23 (std::print, Deducing this)',
    'C++20 (Concepts, Ranges, Coroutines)',
    'C++17 (Structured Binding, Filesystem)',
    'C17 (ISO/IEC 9899:2018)'
  ],
  'Docker': [
    'Docker Compose v2 / BuildKit',
    'OCI Container Specification'
  ]
};

export const INITIAL_MODULES: ModuleItem[] = [
  {
    id: 'mod-root',
    name: 'intellij-idea-clone',
    type: 'TypeScript / React / Vite',
    path: 'D:\\IDE',
    sources: ['src', 'src/components', 'src/constants', 'src/types', 'src/themes'],
    tests: ['tests', 'src/__tests__'],
    resources: ['public', 'src/assets'],
    excluded: ['node_modules', 'dist', '.git', '.vscode', 'dist-portable'],
    dependencies: [
      { name: '<Project SDK: Rust 1.99.1>', version: '1.99.1', scope: 'Compile', exported: false },
      { name: 'react', version: '^18.3.1', scope: 'Compile', exported: true },
      { name: 'react-dom', version: '^18.3.1', scope: 'Compile', exported: true },
      { name: '@monaco-editor/react', version: '^4.7.0', scope: 'Compile', exported: true },
      { name: '@tauri-apps/api', version: '^2.12.4', scope: 'Compile', exported: true },
      { name: 'lucide-react', version: '^1.16.0', scope: 'Compile', exported: false },
      { name: 'tailwindcss', version: '^3.4.14', scope: 'Provided', exported: false },
      { name: 'vite', version: '^5.4.10', scope: 'Provided', exported: false },
      { name: 'vitest', version: '^2.0.0', scope: 'Test', exported: false },
    ]
  },
  {
    id: 'mod-tauri',
    name: 'src-tauri (Core Backend)',
    type: 'Rust Native Workspace',
    path: 'D:\\IDE\\src-tauri',
    sources: ['src-tauri/src', 'src-tauri/src/lib.rs', 'src-tauri/src/main.rs'],
    tests: ['src-tauri/tests'],
    resources: ['src-tauri/icons', 'src-tauri/capabilities'],
    excluded: ['src-tauri/target'],
    dependencies: [
      { name: '<Rust MSVC x86_64 Toolchain>', version: '1.99.1', scope: 'Compile', exported: false },
      { name: 'tauri', version: '2.12.5', scope: 'Compile', exported: true },
      { name: 'tauri-plugin-log', version: '2.0.0', scope: 'Compile', exported: false },
      { name: 'serde', version: '1.0', scope: 'Compile', exported: true },
      { name: 'serde_json', version: '1.0', scope: 'Compile', exported: true },
      { name: 'cargo-test', version: '1.99.1', scope: 'Test', exported: false },
    ]
  }
];

export const INITIAL_LIBRARIES: LibraryItem[] = [
  { id: 'lib-tauri', name: 'tauri', version: '2.12.5', type: 'Cargo Crate', location: '~/.cargo/registry/cache/tauri-2.12.5', usedIn: ['src-tauri'] },
  { id: 'lib-serde', name: 'serde', version: '1.0.218', type: 'Cargo Crate', location: '~/.cargo/registry/cache/serde-1.0.218', usedIn: ['src-tauri'] },
  { id: 'lib-react', name: 'react', version: '18.3.1', type: 'NPM Package', location: 'node_modules/react', usedIn: ['intellij-idea-clone'] },
  { id: 'lib-monaco', name: '@monaco-editor/react', version: '4.7.0', type: 'NPM Package', location: 'node_modules/@monaco-editor/react', usedIn: ['intellij-idea-clone'] },
  { id: 'lib-xterm', name: '@xterm/xterm', version: '6.0.0', type: 'NPM Package', location: 'node_modules/@xterm/xterm', usedIn: ['intellij-idea-clone'] },
  { id: 'lib-rust-std', name: 'rust-std', version: '1.99.1', type: 'Standard Library', location: '~/.rustup/toolchains/stable/lib', usedIn: ['src-tauri'] },
];

export const INITIAL_FACETS: FacetItem[] = [
  { id: 'fac-tauri', name: 'Tauri v2 Native Desktop', type: 'Tauri Framework', module: 'src-tauri', configFile: 'src-tauri/tauri.conf.json', description: 'Cross-platform native window rendering with Rust commands and WRY WebView2 engine' },
  { id: 'fac-react', name: 'React 18 + Vite', type: 'Frontend Framework', module: 'intellij-idea-clone', configFile: 'vite.config.ts', description: 'Modern single-page desktop client with HMR, TypeScript JSX, and Tailwind CSS' },
  { id: 'fac-cargo', name: 'Cargo Package Manager', type: 'Rust Build System', module: 'src-tauri', configFile: 'src-tauri/Cargo.toml', description: 'Package manifest with dependency graph management and MSVC linking' },
];

export const INITIAL_ARTIFACTS: ArtifactItem[] = [
  { id: 'art-portable', name: 'intellij-idea-clone:portable-zip', type: 'Web Distribution Bundle', outputDirectory: 'D:\\IDE\\dist-portable\\IntelliJ-IDEA-Portable.zip', includeInBuild: true },
  { id: 'art-app', name: 'intellij-idea-clone:native-binary', type: 'Native Executable', outputDirectory: 'D:\\IDE\\src-tauri\\target\\release\\app.exe', includeInBuild: true },
  { id: 'art-nsis', name: 'intellij-idea-clone:nsis-installer', type: 'NSIS Setup Installer', outputDirectory: 'D:\\IDE\\src-tauri\\target\\release\\bundle\\nsis', includeInBuild: true },
  { id: 'art-dist', name: 'intellij-idea-clone:web-dist', type: 'Web Distribution Bundle', outputDirectory: 'D:\\IDE\\dist', includeInBuild: true },
];

export const INITIAL_SDKS: SdkItem[] = [
  { id: 'sdk-rust', name: 'Rust (System Toolchain)', version: 'stable', type: 'Rust', homePath: '~/.rustup/toolchains', binaries: ['rustc.exe', 'cargo.exe', 'rustfmt.exe'] },
  { id: 'sdk-node', name: 'Node.js LTS', version: 'current', type: 'Node.js', homePath: 'C:\\Program Files\\nodejs', binaries: ['node.exe', 'npm.cmd', 'npx.cmd'] },
  { id: 'sdk-python', name: 'Python 3', version: '3.x', type: 'Python', homePath: 'python', binaries: ['python.exe', 'pip.exe'] },
  { id: 'sdk-java', name: 'Java JDK', version: 'current', type: 'Java', homePath: 'C:\\Program Files\\Java', binaries: ['java.exe', 'javac.exe'] },
  { id: 'sdk-go', name: 'Go SDK', version: 'current', type: 'Go', homePath: 'C:\\Program Files\\Go', binaries: ['go.exe', 'gofmt.exe'] },
];

export const INITIAL_GLOBAL_LIBRARIES: GlobalLibraryItem[] = [
  { name: 'Cargo Global Cache', path: '~/.cargo/registry/cache', size: 'Active' },
  { name: 'Node Global NPM Modules', path: '~/AppData/Roaming/npm/node_modules', size: 'Active' },
  { name: 'Rustup Stable Toolchains', path: '~/.rustup/toolchains', size: 'Active' },
  { name: 'Go Module Cache', path: '~/go/pkg/mod', size: 'Active' },
  { name: 'Maven Local Repository (.m2)', path: '~/.m2/repository', size: 'Active' },
];
