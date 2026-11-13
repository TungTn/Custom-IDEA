import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FileNode, RunConfiguration, RunLog } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { getSecret } from '../services/secretService';
import { getSavedSonarBinding } from '../features/sonar/sonarService';

function parseCommandLineArgs(cmdStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < cmdStr.length; i++) {
    const char = cmdStr[i];
    if ((char === '"' || char === "'") && (!inQuotes || quoteChar === char)) {
      inQuotes = !inQuotes;
      if (inQuotes) {
        quoteChar = char;
      } else {
        quoteChar = '';
      }
    } else if (char === ' ' && !inQuotes) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0) {
    args.push(current);
  }
  return args;
}

function getMavenRunnerEnv(): Record<string, string> {
  const s = useSettingsStore.getState().settings;
  const env: Record<string, string> = {};
  if (s.mavenRunnerVmOptions?.trim()) {
    env['MAVEN_OPTS'] = s.mavenRunnerVmOptions.trim();
  }
  if (s.mavenRunnerJdk?.trim()) {
    const jdk = s.mavenRunnerJdk.trim();
    if (!jdk.includes('nampa') && !jdk.includes('graalvm-jdk-21.0.7')) {
      env['JAVA_HOME'] = jdk;
    }
  }
  if (s.mavenRunnerEnv) {
    if (typeof s.mavenRunnerEnv === 'string') {
      const lines = (s.mavenRunnerEnv as string).split('\n');
      for (const line of lines) {
        const idx = line.indexOf('=');
        if (idx > 0) {
          const k = line.substring(0, idx).trim();
          const v = line.substring(idx + 1).trim();
          if (k) env[k] = v;
        }
      }
    } else if (typeof s.mavenRunnerEnv === 'object') {
      Object.assign(env, s.mavenRunnerEnv);
    }
  }
  return env;
}

export interface UseProcessRunnerOptions {
  currentProjectDirectory: string;
  files: FileNode[];
  saveAllFiles: (isManual?: boolean) => Promise<void>;
  addToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  setBottomTab: (tab: 'find' | 'run' | 'debug' | 'terminal' | 'problems' | 'git' | 'tests') => void;
  setIsBottomOpen: (open: boolean) => void;
}

export function useProcessRunner({
  currentProjectDirectory,
  files,
  saveAllFiles,
  addToast,
  setBottomTab,
  setIsBottomOpen,
}: UseProcessRunnerOptions) {
  // ─── 1. Run Configurations State & Auto-upgrade ───
  const [runConfigurations, setRunConfigurations] = useState<RunConfiguration[]>(() => {
    try {
      const saved = localStorage.getItem('intellij_run_configurations');
      if (saved) {
        const parsed: RunConfiguration[] = JSON.parse(saved);
        // Safely upgrade legacy cramped 256m/384m configurations that cause javac OutOfMemoryError on projects with many files
        return parsed.map(c => {
          let updatedCmd = c.command;
          if (updatedCmd && updatedCmd.includes('nampa')) {
            updatedCmd = 'mvn';
          }
          if (c.type === 'spring-boot' || (updatedCmd && (updatedCmd.includes('mvn') || updatedCmd.includes('gradle')))) {
            const envs = { ...(c.envVars || {}) };
            const currentOpts = envs['JAVA_TOOL_OPTIONS'] || '';
            // If the configuration has the cramped 256m/384m heap, upgrade it to 1024m to prevent OutOfMemoryError
            if (currentOpts.includes('-Xmx256m') || currentOpts.includes('-Xmx384m')) {
              envs['JAVA_TOOL_OPTIONS'] = '-Xms128m -Xmx1024m -Xss512k -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=128m';
              if (!envs['MAVEN_OPTS'] || envs['MAVEN_OPTS'].includes('-Xmx96m')) {
                envs['MAVEN_OPTS'] = '-Xms64m -Xmx256m';
              }
              return { ...c, command: updatedCmd, envVars: envs };
            }
          }
          return { ...c, command: updatedCmd };
        });
      }
    } catch (e) {
      console.warn('Failed to parse saved run configurations:', e);
    }
    return [];
  });

  const [activeConfigId, setActiveConfigId] = useState<string | null>(() => {
    return localStorage.getItem('intellij_active_run_config_id') || null;
  });

  // ─── 2. Running State & Log Batching (Smooth 25fps) ───
  const [isRunning, setIsRunning] = useState(false);
  const activeRunIdRef = useRef<string | null>(null);
  const pendingLogsRef = useRef<RunLog[]>([]);
  const logFlushTimeoutRef = useRef<any>(null);

  const [runLogs, setRunLogs] = useState<RunLog[]>([
    {
      id: '1',
      text: 'IntelliJ IDE Run Console ready.',
      type: 'info',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const flushLogs = useCallback(() => {
    if (pendingLogsRef.current.length === 0) return;
    const batch = pendingLogsRef.current;
    pendingLogsRef.current = [];
    setRunLogs(prev => {
      const merged = [...prev, ...batch];
      if (merged.length > 1500) {
        return merged.slice(merged.length - 1400);
      }
      return merged;
    });
  }, []);

  // ─── 3. Listen to live Tauri process stdout/stderr and exit events ───
  useEffect(() => {
    let isMounted = true;
    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          const outListener = await listen<{ run_id: string; text: string; stream: string; lines?: string[] }>(
            'process-output',
            (event) => {
              const { text, stream, lines } = event.payload;
              const rawLines = lines && lines.length > 0 ? lines : text.split('\n');
              const timestamp = new Date().toLocaleTimeString();
              const type = (stream === 'stderr' ? 'warning' : 'info') as 'warning' | 'info';

              for (const line of rawLines) {
                if (line.trim().length === 0 && rawLines.length > 1) continue;
                pendingLogsRef.current.push({
                  id: `${Date.now()}-${Math.random()}`,
                  text: line,
                  type,
                  timestamp,
                });
              }

              if (!logFlushTimeoutRef.current) {
                logFlushTimeoutRef.current = setTimeout(() => {
                  logFlushTimeoutRef.current = null;
                  flushLogs();
                }, 40); // Max 25 FPS update rate for smooth 60fps IDE UI
              }
            }
          );
          if (!isMounted) {
            outListener();
            return;
          }
          unlistenOutput = outListener;

          const exitListener = await listen<{ run_id: string; exit_code: number; success: boolean }>(
            'process-terminated',
            (event) => {
              const { exit_code, success } = event.payload;
              setIsRunning(false);
              activeRunIdRef.current = null;
              if (logFlushTimeoutRef.current) {
                clearTimeout(logFlushTimeoutRef.current);
                logFlushTimeoutRef.current = null;
              }
              flushLogs();
              setRunLogs(prev => [
                ...prev,
                {
                  id: `${Date.now()}-${Math.random()}`,
                  text: `Process finished with exit code ${exit_code}`,
                  type: success ? 'success' : 'error',
                  timestamp: new Date().toLocaleTimeString(),
                },
              ]);
              addToast(
                success ? 'Process Finished' : 'Process Failed',
                `Exit code: ${exit_code}`,
                success ? 'success' : 'error'
              );
            }
          );
          if (!isMounted) {
            exitListener();
            return;
          }
          unlistenExit = exitListener;
        }
      } catch (e) {
        console.warn('Tauri event listen not available:', e);
      }
    };

    setupListeners();

    return () => {
      isMounted = false;
      if (logFlushTimeoutRef.current) clearTimeout(logFlushTimeoutRef.current);
      if (unlistenOutput) unlistenOutput();
      if (unlistenExit) unlistenExit();
    };
  }, [addToast, flushLogs]);

  // ─── 4. Detect Default Run Configurations for Project ───
  const detectDefaultConfigurations = useCallback(
    (rootNode: FileNode, existingConfigs: RunConfiguration[]): RunConfiguration[] => {
      const rootPath = rootNode.path || '';
      const childNames = rootNode.children ? rootNode.children.map(c => c.name.toLowerCase()) : [];
      const rootName = rootNode.name || 'Application';

      const hasExistingForPath = existingConfigs.some(c => c.workingDirectory === rootPath);
      if (hasExistingForPath) return existingConfigs;

      const generated: RunConfiguration[] = [];

      if (childNames.includes('pom.xml')) {
        const mavenCmd = childNames.includes('mvnw.cmd') ? 'mvnw.cmd' : 'mvn.cmd';
        generated.push({
          id: `cfg-spring-${Date.now()}`,
          name: `${rootName} (Spring Boot)`,
          type: 'spring-boot',
          command: mavenCmd,
          args: ['spring-boot:run'],
          workingDirectory: rootPath,
          envVars: {
            SPRING_PROFILES_ACTIVE: 'dev',
            JAVA_TOOL_OPTIONS:
              '-Xms128m -Xmx1024m -Xss512k -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=128m',
            MAVEN_OPTS: '-Xms64m -Xmx256m',
          },
          isDefault: true,
        });
        generated.push({
          id: `cfg-mvn-build-${Date.now() + 1}`,
          name: `${rootName} (Maven Package)`,
          type: 'maven',
          command: mavenCmd,
          args: ['clean', 'package', '-DskipTests'],
          workingDirectory: rootPath,
          envVars: {
            MAVEN_OPTS: '-Xms32m -Xmx128m -XX:+UseSerialGC',
          },
        });
      } else if (childNames.includes('build.gradle') || childNames.includes('build.gradle.kts')) {
        generated.push({
          id: `cfg-gradle-${Date.now()}`,
          name: `${rootName} (Gradle bootRun)`,
          type: 'gradle',
          command: 'gradlew.bat',
          args: [
            'bootRun',
            '-Dorg.gradle.jvmargs=-Xms64m -Xmx384m -Xss256k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m',
          ],
          workingDirectory: rootPath,
          envVars: {
            JAVA_TOOL_OPTIONS:
              '-Xms64m -Xmx384m -Xss256k -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=384m -XX:ReservedCodeCacheSize=96m',
          },
          isDefault: true,
        });
      } else if (childNames.includes('cargo.toml')) {
        generated.push({
          id: `cfg-cargo-${Date.now()}`,
          name: `${rootName} (Cargo Run)`,
          type: 'cargo',
          command: 'cargo',
          args: ['run'],
          workingDirectory: rootPath,
          isDefault: true,
        });
      } else if (childNames.includes('package.json')) {
        generated.push({
          id: `cfg-npm-${Date.now()}`,
          name: `${rootName} (npm run dev)`,
          type: 'npm',
          command: 'npm',
          args: ['run', 'dev'],
          workingDirectory: rootPath,
          isDefault: true,
        });
      } else if (childNames.includes('requirements.txt') || childNames.includes('main.py')) {
        generated.push({
          id: `cfg-python-${Date.now()}`,
          name: `${rootName} (Python main.py)`,
          type: 'python',
          command: 'python',
          args: ['main.py'],
          workingDirectory: rootPath,
          isDefault: true,
        });
      }

      if (generated.length === 0) {
        generated.push({
          id: `cfg-default-${Date.now()}`,
          name: `${rootName} (Check)`,
          type: 'cargo',
          command: 'cargo',
          args: ['check', '--all-targets'],
          workingDirectory: rootPath,
          isDefault: true,
        });
      }

      const merged = [...existingConfigs, ...generated];
      try {
        localStorage.setItem('intellij_run_configurations', JSON.stringify(merged));
      } catch (e) {
        console.warn(e);
      }
      return merged;
    },
    []
  );

  // ─── 5. Run Action (Shift+F10 / Toolbar Run) ───
  const handleRun = useCallback(async () => {
    // If a process is already running, terminate it first (Stop & Rerun / Single Instance)
    if (isRunning || activeRunIdRef.current) {
      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          await invoke('stop_all_processes');
        }
      } catch (e) {
        console.warn('Failed to stop previous process:', e);
      }
      await new Promise(r => setTimeout(r, 250));
    }

    const activeCfg = runConfigurations.find(c => c.id === activeConfigId) || runConfigurations[0];
    const projectDir = activeCfg?.workingDirectory || currentProjectDirectory;
    let cmd = activeCfg?.command || 'cargo';
    if (cmd.includes('nampa')) {
      cmd = 'mvn';
    }
    let args = activeCfg?.args ? [...activeCfg.args] : ['check', '--all-targets'];
    const envVars = { ...(activeCfg?.envVars || {}) };

    const s = useSettingsStore.getState().settings;
    if (cmd.toLowerCase().includes('mvn') || activeCfg?.type === 'maven') {
      const isCustomValid = s.mavenHomePath === 'custom' && s.mavenCustomPath && !s.mavenCustomPath.includes('nampa') && !s.mavenCustomPath.includes('wrapper\\dists') && !s.mavenCustomPath.includes('wrapper/dists');
      if (isCustomValid) {
        cmd = s.mavenCustomPath!.endsWith('.cmd') || s.mavenCustomPath!.endsWith('.exe') || s.mavenCustomPath!.endsWith('mvn')
          ? s.mavenCustomPath!
          : `${s.mavenCustomPath!.replace(/[/\\]+$/, '')}\\bin\\mvn.cmd`;
      } else {
        const hasWrapper = files.some(f => f.name === 'mvnw.cmd' || f.name === 'mvnw');
        if (hasWrapper && s.mavenHomePath !== 'bundled') {
          cmd = navigator.platform.toLowerCase().includes('win') ? 'mvnw.cmd' : './mvnw';
        } else if (cmd.includes('\\') || cmd.includes('/')) {
          cmd = 'mvn';
        }
      }
      if (s.mavenOverrideGlobalSettings && s.mavenGlobalSettings && !args.includes('-gs')) {
        args.push('-gs', s.mavenGlobalSettings);
      }
      if (s.mavenOverrideUserSettings && s.mavenUserSettings && !args.includes('-s')) {
        args.push('-s', s.mavenUserSettings);
      }
      if (s.mavenOverrideLocalRepo && s.mavenLocalRepo && !args.some(a => a.startsWith('-Dmaven.repo.local='))) {
        args.push(`-Dmaven.repo.local=${s.mavenLocalRepo}`);
      }
      if (s.mavenSkipTests && !args.includes('-DskipTests')) {
        args.push('-DskipTests');
      }
      if (s.mavenOfflineMode && !args.includes('-o')) {
        args.push('-o');
      }
      Object.assign(envVars, getMavenRunnerEnv());
    }

    const runId = `run-${Date.now()}`;
    activeRunIdRef.current = runId;
    setIsRunning(true);
    setBottomTab('run');
    setIsBottomOpen(true);

    const timestamp = new Date().toLocaleTimeString();

    setRunLogs([
      {
        id: String(Date.now()),
        text: `${cmd} ${args.join(' ')}`,
        type: 'cmd',
        timestamp,
      },
      {
        id: String(Date.now() + 1),
        text: `Working directory: ${projectDir}`,
        type: 'info',
        timestamp,
      },
    ]);

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('start_process', {
          runId,
          command: cmd,
          args,
          cwd: projectDir,
          envVars: envVars || null,
        });
      } else {
        // Fallback for browser-only dev testing
        setTimeout(() => {
          setIsRunning(false);
          setRunLogs(prev => [
            ...prev,
            {
              id: String(Date.now() + 2),
              text: 'Process finished with exit code 0',
              type: 'success',
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
        }, 1200);
      }
    } catch (err) {
      setIsRunning(false);
      activeRunIdRef.current = null;
      setRunLogs(prev => [
        ...prev,
        {
          id: String(Date.now()),
          text: `Failed to spawn process: ${err}`,
          type: 'error',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      addToast('Run Error', String(err), 'error');
    }
  }, [isRunning, runConfigurations, activeConfigId, currentProjectDirectory, files, setBottomTab, setIsBottomOpen, addToast]);

  // ─── 6. Stop Action (Ctrl+F2 / Toolbar Stop) ───
  const handleStop = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        await invoke('stop_all_processes');
      }
    } catch (e) {
      console.warn('Failed to stop process:', e);
    }
    activeRunIdRef.current = null;
    setIsRunning(false);
    setRunLogs(prev => [
      ...prev,
      {
        id: String(Date.now()),
        text: 'Process terminated by user (Ctrl+F2)',
        type: 'warning',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    addToast('Process Terminated', 'Stopped running process', 'warning');
  }, [addToast]);

  // ─── 7. Build Project Action (Ctrl+F9 / Build Project) ───
  const handleBuild = useCallback(
    async (action: 'build' | 'rebuild' | 'clean' = 'build') => {
      await saveAllFiles(false);

      if (isRunning || activeRunIdRef.current) {
        try {
          if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
            await invoke('stop_all_processes');
          }
        } catch (e) {
          console.warn('Failed to stop previous process:', e);
        }
        await new Promise(r => setTimeout(r, 200));
      }

      const projectDir = currentProjectDirectory;
      let buildCmd = 'cargo';
      let buildArgs = ['build'];

      const hasFile = (name: string) => files.some(f => f.name.toLowerCase() === name.toLowerCase());

      if (hasFile('Cargo.toml')) {
        buildCmd = 'cargo';
        buildArgs = action === 'clean' ? ['clean'] : action === 'rebuild' ? ['clean'] : ['build'];
      } else if (hasFile('package.json')) {
        buildCmd = 'npm';
        buildArgs = action === 'clean' ? ['run', 'clean'] : ['run', 'build'];
      } else if (hasFile('pom.xml')) {
        buildCmd = 'mvn';
        buildArgs = action === 'clean' ? ['clean'] : action === 'rebuild' ? ['clean', 'compile'] : ['compile'];
      } else if (hasFile('build.gradle') || hasFile('build.gradle.kts')) {
        buildCmd = 'gradle';
        buildArgs = action === 'clean' ? ['clean'] : action === 'rebuild' ? ['clean', 'build'] : ['build'];
      }

      let buildEnv: Record<string, string> | undefined;
      if (buildCmd.toLowerCase().includes('mvn')) {
        const s = useSettingsStore.getState().settings;
        const isCustomValid = s.mavenHomePath === 'custom' && s.mavenCustomPath && !s.mavenCustomPath.includes('nampa') && !s.mavenCustomPath.includes('wrapper\\dists') && !s.mavenCustomPath.includes('wrapper/dists');
        if (isCustomValid) {
          buildCmd = s.mavenCustomPath!.endsWith('.cmd') || s.mavenCustomPath!.endsWith('.exe') || s.mavenCustomPath!.endsWith('mvn')
            ? s.mavenCustomPath!
            : `${s.mavenCustomPath!.replace(/[/\\]+$/, '')}\\bin\\mvn.cmd`;
        } else {
          const hasWrapper = files.some(f => f.name === 'mvnw.cmd' || f.name === 'mvnw');
          if (hasWrapper && s.mavenHomePath !== 'bundled') {
            buildCmd = navigator.platform.toLowerCase().includes('win') ? 'mvnw.cmd' : './mvnw';
          }
        }
        if (s.mavenOverrideGlobalSettings && s.mavenGlobalSettings && !buildArgs.includes('-gs')) {
          buildArgs.push('-gs', s.mavenGlobalSettings);
        }
        if (s.mavenOverrideUserSettings && s.mavenUserSettings && !buildArgs.includes('-s')) {
          buildArgs.push('-s', s.mavenUserSettings);
        }
        if (s.mavenOverrideLocalRepo && s.mavenLocalRepo && !buildArgs.some(a => a.startsWith('-Dmaven.repo.local='))) {
          buildArgs.push(`-Dmaven.repo.local=${s.mavenLocalRepo}`);
        }
        if (s.mavenSkipTests && !buildArgs.includes('-DskipTests')) {
          buildArgs.push('-DskipTests');
        }
        if (s.mavenOfflineMode && !buildArgs.includes('-o')) {
          buildArgs.push('-o');
        }
        buildEnv = getMavenRunnerEnv();
      }

      const runId = `build-${Date.now()}`;
      activeRunIdRef.current = runId;
      setIsRunning(true);
      setBottomTab('run');
      setIsBottomOpen(true);

      const timestamp = new Date().toLocaleTimeString();
      setRunLogs([
        {
          id: String(Date.now()),
          text: `Executing build: ${buildCmd} ${buildArgs.join(' ')}`,
          type: 'cmd',
          timestamp,
        },
        {
          id: String(Date.now() + 1),
          text: `Project Root: ${projectDir}`,
          type: 'info',
          timestamp,
        },
      ]);

      try {
        if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
          await invoke('start_process', {
            runId,
            command: buildCmd,
            args: buildArgs,
            cwd: projectDir,
            envVars: buildEnv && Object.keys(buildEnv).length > 0 ? buildEnv : null,
          });
          addToast(action === 'clean' ? 'Build Cleaned' : 'Build Started', `${buildCmd} ${buildArgs.join(' ')}`, 'info');
        } else {
          setTimeout(() => {
            setIsRunning(false);
            setRunLogs(prev => [
              ...prev,
              {
                id: String(Date.now()),
                text: 'Build finished with 0 errors.',
                type: 'info',
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
            addToast('Build Finished', 'Compilation completed with 0 errors', 'success');
          }, 1200);
        }
      } catch (e: any) {
        console.error('Failed to trigger build:', e);
        setIsRunning(false);
        activeRunIdRef.current = null;
        setRunLogs(prev => [
          ...prev,
          {
            id: String(Date.now()),
            text: `Build execution error: ${e?.message || e}`,
            type: 'error',
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        addToast('Build Error', String(e), 'error');
      }
    },
    [saveAllFiles, isRunning, currentProjectDirectory, files, setBottomTab, setIsBottomOpen, addToast]
  );

  // ─── 8. Execute Custom Build Task ───
  const handleExecuteBuildTask = useCallback(
    async (tool: string, taskName: string, command: string) => {
      setBottomTab('run');
      setIsBottomOpen(true);
      setIsRunning(true);
      addToast('Executing Build Task', command, 'info');

      const projectDir = currentProjectDirectory;
      const newLog: RunLog = {
        id: `log-${Date.now()}`,
        text: `$ ${command}\nExecuting build task [${tool}: ${taskName}] in ${projectDir}...\n`,
        type: 'cmd',
        timestamp: new Date().toLocaleTimeString(),
      };
      setRunLogs(prev => [...prev, newLog]);

      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const parts = parseCommandLineArgs(command);
        let cmd = parts[0] || 'mvn';
        let args = parts.slice(1);
        if (cmd.includes('nampa')) {
          cmd = 'mvn';
        }
        const isMaven = tool === 'maven' || cmd.toLowerCase().includes('mvn');

        const s = useSettingsStore.getState().settings;
        if (isMaven) {
          const isCustomValid = s.mavenHomePath === 'custom' && s.mavenCustomPath && !s.mavenCustomPath.includes('nampa') && !s.mavenCustomPath.includes('wrapper\\dists') && !s.mavenCustomPath.includes('wrapper/dists');
          if (isCustomValid && (cmd === 'mvn' || cmd === 'mvn.cmd')) {
            cmd = s.mavenCustomPath!.endsWith('.cmd') || s.mavenCustomPath!.endsWith('.exe') || s.mavenCustomPath!.endsWith('mvn')
              ? s.mavenCustomPath!
              : `${s.mavenCustomPath!.replace(/[/\\]+$/, '')}\\bin\\mvn.cmd`;
          } else if (!isCustomValid && (cmd.includes('\\') || cmd.includes('/'))) {
            const hasWrapper = files.some(f => f.name === 'mvnw.cmd' || f.name === 'mvnw');
            if (hasWrapper && s.mavenHomePath !== 'bundled') {
              cmd = navigator.platform.toLowerCase().includes('win') ? 'mvnw.cmd' : './mvnw';
            } else {
              cmd = 'mvn';
            }
          }
          if (s.mavenOverrideGlobalSettings && s.mavenGlobalSettings && !args.includes('-gs')) {
            args.push('-gs', s.mavenGlobalSettings);
          }
          if (s.mavenOverrideUserSettings && s.mavenUserSettings && !args.includes('-s')) {
            args.push('-s', s.mavenUserSettings);
          }
          if (s.mavenOverrideLocalRepo && s.mavenLocalRepo && !args.some(a => a.startsWith('-Dmaven.repo.local='))) {
            args.push(`-Dmaven.repo.local=${s.mavenLocalRepo}`);
          }
          if (s.mavenSkipTests && !args.includes('-DskipTests')) {
            args.push('-DskipTests');
          }
          if (s.mavenOfflineMode && !args.includes('-o')) {
            args.push('-o');
          }
        }
        const envVars = isMaven ? getMavenRunnerEnv() : {};
        if (command.includes('sonar') || args.some(a => a.includes('sonar'))) {
          try {
            const binding = getSavedSonarBinding();
            const sonarToken =
              (binding.connectionId ? await getSecret('sonar', binding.connectionId) : null) ||
              (await getSecret('sonar', 'default'));
            if (sonarToken) {
              envVars['SONAR_TOKEN'] = sonarToken;
            }
          } catch {}
        }

        try {
          const res = await invoke<{ stdout: string; stderr: string; exit_code: number }>('execute_build_command', {
            command: cmd,
            args,
            cwd: projectDir,
            envVars: envVars && Object.keys(envVars).length > 0 ? envVars : null,
          });
          setIsRunning(false);
          if (res.stdout) {
            setRunLogs(prev => [
              ...prev,
              {
                id: `log-${Date.now()}-out`,
                text: res.stdout,
                type: 'info',
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }
          if (res.stderr) {
            setRunLogs(prev => [
              ...prev,
              {
                id: `log-${Date.now()}-err`,
                text: res.stderr,
                type: res.exit_code === 0 ? 'warning' : 'error',
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }
          setRunLogs(prev => [
            ...prev,
            {
              id: `log-${Date.now()}-done`,
              text: `Process finished with exit code ${res.exit_code}`,
              type: res.exit_code === 0 ? 'success' : 'error',
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
          addToast('Build Task Finished', `${command} exited with code ${res.exit_code}`, res.exit_code === 0 ? 'success' : 'error');
        } catch (err) {
          setIsRunning(false);
          setRunLogs(prev => [
            ...prev,
            {
              id: `log-${Date.now()}-err`,
              text: `Build execution error: ${String(err)}`,
              type: 'error',
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
          addToast('Build Task Failed', String(err), 'error');
        }
      } else {
        setTimeout(() => {
          setIsRunning(false);
          setRunLogs(prev => [
            ...prev,
            {
              id: `log-${Date.now()}-preview`,
              text: `Compiling workspace [${projectDir}]...\nFinished in 0.38s\nProcess finished with exit code 0`,
              type: 'success',
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
          addToast('Build Finished', `${command} completed successfully`, 'success');
        }, 700);
      }
    },
    [files, setBottomTab, setIsBottomOpen, addToast, currentProjectDirectory]
  );

  return {
    isRunning,
    setIsRunning,
    runLogs,
    setRunLogs,
    runConfigurations,
    setRunConfigurations,
    activeConfigId,
    setActiveConfigId,
    handleRun,
    handleStop,
    handleBuild,
    handleExecuteBuildTask,
    detectDefaultConfigurations,
  };
}
