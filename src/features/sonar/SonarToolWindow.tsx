import React, { useState, useMemo, useEffect } from 'react';
import { 
  Play, 
  RotateCw, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ShieldAlert, 
  Flame, 
  Search, 
  Filter, 
  ExternalLink, 
  FileCode, 
  ChevronRight, 
  ChevronDown, 
  Sparkles,
  Layers,
  Bug,
  ShieldCheck,
  Zap,
  Check,
  Globe,
  Key,
  FolderGit2,
  Settings as SettingsIcon,
  RefreshCw,
  X,
  Maximize2,
  Minus,
  Copy
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { OpenTab } from '../../types';
import { 
  getSavedSonarConfig, 
  saveSonarConfig, 
  checkSonarServer, 
  fetchSonarQualityGate, 
  fetchSonarIssues, 
  buildMavenSonarCommand,
  SonarServerConfig,
  SonarRemoteIssue
} from './sonarService';

export interface SonarIssue {
  id: string;
  ruleKey: string;
  ruleName: string;
  message: string;
  filePath: string;
  fileName: string;
  line: number;
  column: number;
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
  type: 'BUG' | 'VULNERABILITY' | 'CODE_SMELL' | 'SECURITY_HOTSPOT';
  effort: string;
  isRemote?: boolean;
  explanation: {
    why: string;
    noncompliant: string;
    compliant: string;
  };
}

export interface SonarAnalysisProgress {
  isAnalyzing: boolean;
  message: string;
  filesCount?: number;
  currentFileName?: string;
  progressPercent?: number;
}

export interface SonarToolWindowProps {
  activeTab?: OpenTab;
  currentProjectDirectory: string;
  onOpenFileAtLocation: (filePath: string, line: number, col?: number) => void;
  onExecuteMavenGoal?: (goal: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenSettings?: () => void;
  onToggleMaximize?: () => void;
  onHide?: () => void;
  onAnalysisStateChange?: (state: SonarAnalysisProgress | null) => void;
  targetScanPath?: { path: string; isFolder: boolean; timestamp: number } | null;
  cancelSignal?: number;
}

export const SonarIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 16C4 9.92487 8.92487 5 15 5"
      stroke="#4B9FD5"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M4 16C4 12.6863 6.68629 10 10 10"
      stroke="#4B9FD5"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M4 16C4 14.3431 5.34315 13 7 13"
      stroke="#4B9FD5"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="4" cy="16" r="1.2" fill="#4B9FD5" />
  </svg>
);

export const analyzeCodeForSonarIssues = (code: string, filePath: string): SonarIssue[] => {
  const issues: SonarIssue[] = [];
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() || 'File';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const lines = code.split('\n');

  const isJava = ext === 'java';
  const isVue = ext === 'vue';
  const isJSOrTS = ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx' || isVue;

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const trimmed = lineText.trim();

    // ─── 1. UNIVERSAL RULES (All Languages) ───
    // Hardcoded credentials / passwords / secret keys
    if (/(password|secret|token|api[_-]?key|passwd)\s*[:=]\s*["'][^"']{4,}["']/i.test(trimmed) &&
        !trimmed.includes('System.getenv') &&
        !trimmed.includes('process.env') &&
        !trimmed.includes('import.meta.env') &&
        !trimmed.includes('${') &&
        !trimmed.includes('properties')) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-cred`,
        ruleKey: isJava ? 'java:S2068' : 'javascript:S2068',
        ruleName: 'Credentials should not be hard-coded',
        message: 'Hard-coded credentials detected in source code. Extract secrets to environment variables or vault.',
        filePath,
        fileName,
        line: lineNum,
        column: Math.max(1, lineText.search(/password|secret|token/i) + 1),
        severity: 'BLOCKER',
        type: 'VULNERABILITY',
        effort: '20min',
        explanation: {
          why: 'Hardcoded credentials can easily be checked into version control repositories, exposing internal infrastructure and private data to attackers.',
          noncompliant: isJava ? 'String dbPassword = "SuperSecret123!";' : 'const apiKey = "1234567890abcdef";',
          compliant: isJava ? 'String dbPassword = System.getenv("DB_PASSWORD");' : 'const apiKey = process.env.API_KEY;',
        },
      });
    }

    // Empty catch block
    if (/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(trimmed) || 
        (trimmed.startsWith('catch') && lines[idx + 1]?.trim() === '}')) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-catch`,
        ruleKey: isJava ? 'java:S2486' : 'javascript:S2486',
        ruleName: 'Generic exceptions should not be ignored',
        message: 'Either log or rethrow this exception instead of ignoring it with an empty catch block.',
        filePath,
        fileName,
        line: lineNum,
        column: Math.max(1, lineText.indexOf('catch') + 1),
        severity: 'CRITICAL',
        type: 'BUG',
        effort: '10min',
        explanation: {
          why: 'An empty catch block silently ignores errors, hiding failure reasons, masking root causes, and creating unrecoverable deadlocks or corrupted data.',
          noncompliant: 'try { doSomething(); } catch (e) {}',
          compliant: 'try { doSomething(); } catch (e) { console.error(e); }',
        },
      });
    }

    // ─── 2. JAVASCRIPT / TYPESCRIPT / VUE RULES ───
    if (isJSOrTS) {
      // Rule: console.log / console.warn / console.error / alert
      if (/\bconsole\.(log|debug|info|warn|error|dir)\s*\(/.test(trimmed) && !filePath.includes('test')) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-console`,
          ruleKey: 'javascript:S106',
          ruleName: 'Standard outputs should not be used directly to log to console',
          message: 'Unexpected console statement. Remove or replace with an authorized enterprise logger before production.',
          filePath,
          fileName,
          line: lineNum,
          column: Math.max(1, lineText.indexOf('console.') + 1),
          severity: 'MAJOR',
          type: 'CODE_SMELL',
          effort: '5min',
          explanation: {
            why: 'Direct console.log calls pollute the browser/server console, can leak sensitive information, and impact application runtime performance.',
            noncompliant: 'console.log("Downloading template:", response.data);',
            compliant: '// Use a logger or remove debug statements in production',
          },
        });
      }

      // Rule: var keyword instead of let/const
      if (/\bvar\s+[a-zA-Z_$][a-zA-Z0-9_$]*/.test(trimmed) && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-var`,
          ruleKey: 'javascript:S3504',
          ruleName: 'Variables should be declared with "let" or "const"',
          message: 'Replace "var" with "let" or "const" to avoid function-scoped variable hoisting and shadowing.',
          filePath,
          fileName,
          line: lineNum,
          column: Math.max(1, lineText.indexOf('var ') + 1),
          severity: 'MINOR',
          type: 'CODE_SMELL',
          effort: '2min',
          explanation: {
            why: '"var" declarations are hoisted to the enclosing function body and do not observe block scope, frequently causing subtle variable leakage bugs.',
            noncompliant: 'var data = [];',
            compliant: 'const data = []; // or let data = [];',
          },
        });
      }

      // Rule: Nested ternary operators
      if (/\?.*:.*\?/.test(trimmed) || (trimmed.includes('?') && trimmed.includes(':') && trimmed.split('?').length > 2)) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-ternary`,
          ruleKey: 'javascript:S3358',
          ruleName: 'Ternary operators should not be nested',
          message: 'Extract nested ternary expression into an if-else statement or dedicated function for clarity.',
          filePath,
          fileName,
          line: lineNum,
          column: Math.max(1, lineText.indexOf('?') + 1),
          severity: 'MAJOR',
          type: 'CODE_SMELL',
          effort: '10min',
          explanation: {
            why: 'Nested ternary operators degrade readability and make maintenance and unit testing error-prone.',
            noncompliant: 'const status = a ? (b ? "yes" : "maybe") : "no";',
            compliant: 'let status = "no"; if (a) { status = b ? "yes" : "maybe"; }',
          },
        });
      }

      // Rule: == instead of === in JS/TS
      if (/[^!=]==[^=]/.test(trimmed) && !trimmed.includes('== null') && !trimmed.includes('== undefined')) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-eq`,
          ruleKey: 'javascript:S1444',
          ruleName: 'Strict equality operators "===" and "!==" should be used',
          message: 'Expected "===" and instead saw "==". Type coercion in comparison can produce unexpected bugs.',
          filePath,
          fileName,
          line: lineNum,
          column: Math.max(1, lineText.indexOf('==') + 1),
          severity: 'MAJOR',
          type: 'BUG',
          effort: '5min',
          explanation: {
            why: 'The loose equality operator "==" performs automatic type conversion which can lead to counter-intuitive truthiness evaluations.',
            noncompliant: 'if (status == 1) { ... }',
            compliant: 'if (status === 1) { ... }',
          },
        });
      }

      // Rule: TypeScript "any" type
      if (ext.startsWith('ts') || isVue) {
        if (/:\s*any\b|\bas\s+any\b|<any>/.test(trimmed) && !trimmed.startsWith('//')) {
          issues.push({
            id: `sonar-${filePath}-${lineNum}-any`,
            ruleKey: 'typescript:S4323',
            ruleName: 'The "any" type should not be used',
            message: 'Avoid using the "any" type. Provide an explicit interface, union, or "unknown" type.',
            filePath,
            fileName,
            line: lineNum,
            column: Math.max(1, lineText.search(/:\s*any|\bas\s+any|<any>/) + 1),
            severity: 'MINOR',
            type: 'CODE_SMELL',
            effort: '5min',
            explanation: {
              why: '"any" defeats the compile-time type-safety guarantees provided by TypeScript.',
              noncompliant: 'function handleData(payload: any) { ... }',
              compliant: 'function handleData(payload: Record<string, unknown>) { ... }',
            },
          });
        }
      }
    }

    // ─── 3. VUE SPECIFIC RULES ───
    if (isVue) {
      // Rule: v-for missing :key or key
      if (/v-for\s*=\s*["'][^"']+["']/.test(trimmed) && !trimmed.includes(':key') && !trimmed.includes('v-bind:key') && !trimmed.includes('key=')) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-vforkey`,
          ruleKey: 'vue:S6845',
          ruleName: 'Elements inside "v-for" must have an explicit ":key" attribute',
          message: 'The "v-for" directive requires an associated ":key" binding to maintain element identity in virtual DOM.',
          filePath,
          fileName,
          line: lineNum,
          column: Math.max(1, lineText.indexOf('v-for') + 1),
          severity: 'CRITICAL',
          type: 'BUG',
          effort: '5min',
          explanation: {
            why: 'Without unique keys, Vue uses an in-place patch strategy that causes transition bugs, input state desync, and UI corruption.',
            noncompliant: '<li v-for="item in items">{{ item.name }}</li>',
            compliant: '<li v-for="item in items" :key="item.id">{{ item.name }}</li>',
          },
        });
      }

      // Rule: v-if and v-for on the same element
      if (/v-for\s*=\s*["'][^"']+["']/.test(trimmed) && /v-if\s*=\s*["'][^"']+["']/.test(trimmed)) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-vifvfor`,
          ruleKey: 'vue:S6846',
          ruleName: 'Do not use "v-if" and "v-for" on the same element',
          message: 'Avoid pairing "v-if" and "v-for" on the same element. Filter list with a computed property or wrap with <template v-if>.',
          filePath,
          fileName,
          line: lineNum,
          column: Math.max(1, lineText.indexOf('v-if') + 1),
          severity: 'MAJOR',
          type: 'CODE_SMELL',
          effort: '10min',
          explanation: {
            why: 'In Vue 2 and Vue 3, the precedence order of v-if vs v-for differs, causing unoptimized iterations over items that are never rendered.',
            noncompliant: '<div v-for="user in users" v-if="user.isActive" :key="user.id">',
            compliant: '<div v-for="user in activeUsers" :key="user.id">',
          },
        });
      }

      // Rule: Deprecated Vue 2 lifecycle or APIs in modern code
      if (/\b(beforeDestroy|\$listeners|\$destroy|Vue\.set|Vue\.delete)\b/.test(trimmed)) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-vuedeprecated`,
          ruleKey: 'vue:S1874',
          ruleName: 'Deprecated Vue API usage',
          message: 'This Vue API is deprecated. Migrate to Vue 3 lifecycle ("beforeUnmount", etc.) or reactive primitives.',
          filePath,
          fileName,
          line: lineNum,
          column: 1,
          severity: 'MAJOR',
          type: 'CODE_SMELL',
          effort: '10min',
          explanation: {
            why: 'Deprecated APIs will break when upgrading to newer Vue versions.',
            noncompliant: 'beforeDestroy() { clearInterval(this.timer); }',
            compliant: 'beforeUnmount() { clearInterval(this.timer); }',
          },
        });
      }
    }

    // ─── 4. JAVA RULES ───
    if (isJava) {
      // Rule: Java string equality using == instead of .equals()
      if (trimmed.includes('==') && (trimmed.includes('"') || trimmed.includes('String') || /==\s*[a-zA-Z0-9_]+\.get[A-Z]/.test(trimmed))) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-eqjava`,
          ruleKey: 'java:S4973',
          ruleName: 'Strings and Boxed types should be compared with "equals()"',
          message: 'Strings and Boxed types should be compared using ".equals()" rather than "==".',
          filePath,
          fileName,
          line: lineNum,
          column: Math.max(1, lineText.indexOf('==') + 1),
          severity: 'CRITICAL',
          type: 'BUG',
          effort: '5min',
          explanation: {
            why: 'Using == or != to compare objects inspects reference identity rather than semantic equality. For strings or boxed values, this often produces subtle runtime bugs.',
            noncompliant: 'if (status == "ACTIVE") { ... }',
            compliant: 'if ("ACTIVE".equals(status)) { ... }',
          },
        });
      }

      // Rule: System.out.println / System.err.println
      if (/System\.(out|err)\.(print|println|printf)/.test(trimmed)) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-sysout`,
          ruleKey: 'java:S106',
          ruleName: 'Standard outputs should not be used directly to log to console',
          message: 'Replace this use of System.out or System.err with an enterprise logger (SLF4J, Logback, etc.).',
          filePath,
          fileName,
          line: lineNum,
          column: Math.max(1, lineText.indexOf('System.') + 1),
          severity: 'MAJOR',
          type: 'CODE_SMELL',
          effort: '5min',
          explanation: {
            why: 'When logging a message, it should be sent through a dedicated logging framework to ensure appropriate log level filtering, asynchronous formatting, and persistence.',
            noncompliant: 'System.out.println("Processing vehicle: " + vehicleId);',
            compliant: 'log.info("Processing vehicle: {}", vehicleId);',
          },
        });
      }

      // Rule: Spring Boot @Autowired on field
      if (/@Autowired\s*(private|protected|public)?\s+[A-Z][a-zA-Z0-9_<>]+/.test(trimmed) || (trimmed === '@Autowired' && lines[idx + 1] && !lines[idx + 1].includes('('))) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-autowired`,
          ruleKey: 'java:S3749',
          ruleName: 'Members of Spring components should not be field-injected',
          message: 'Spring @Autowired field injection is discouraged. Use constructor injection with Lombok @RequiredArgsConstructor.',
          filePath,
          fileName,
          line: lineNum,
          column: Math.max(1, lineText.indexOf('@Autowired') + 1),
          severity: 'MAJOR',
          type: 'CODE_SMELL',
          effort: '10min',
          explanation: {
            why: 'Field injection makes unit testing difficult (requires reflection), hides dependencies, and prevents final immutable fields.',
            noncompliant: '@Autowired private VehicleService vehicleService;',
            compliant: '@RequiredArgsConstructor\npublic class Controller {\n  private final VehicleService vehicleService;\n}',
          },
        });
      }

      // Rule: SQL Injection concatenation risk
      if (/(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b.*["']\s*\+\s*[a-zA-Z0-9_.]+/i.test(trimmed) && (trimmed.includes('Query') || trimmed.includes('sql') || trimmed.includes('execute') || trimmed.includes('createQuery'))) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-sqlinj`,
          ruleKey: 'java:S2077',
          ruleName: 'Formatting SQL queries is security-sensitive',
          message: 'Potential SQL injection vulnerability! Use parameterized queries or PreparedStatement parameters.',
          filePath,
          fileName,
          line: lineNum,
          column: 1,
          severity: 'BLOCKER',
          type: 'SECURITY_HOTSPOT',
          effort: '25min',
          explanation: {
            why: 'Direct string concatenation into SQL queries exposes the database to SQL injection attacks that can leak or destroy data.',
            noncompliant: 'String sql = "SELECT * FROM vehicles WHERE id = " + vehicleId;',
            compliant: 'PreparedStatement ps = conn.prepareStatement("SELECT * FROM vehicles WHERE id = ?"); ps.setLong(1, vehicleId);',
          },
        });
      }

      // Rule: Unclosed resources
      if (/\b(FileInputStream|FileOutputStream|BufferedReader|Connection|Statement)\s+[a-zA-Z0-9_]+\s*=\s*/.test(trimmed) && !trimmed.startsWith('try') && !code.includes('try (')) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-unclosed`,
          ruleKey: 'java:S2095',
          ruleName: 'Resources should be closed',
          message: 'Use try-with-resources block to ensure this I/O stream or database connection is closed safely.',
          filePath,
          fileName,
          line: lineNum,
          column: 1,
          severity: 'CRITICAL',
          type: 'BUG',
          effort: '15min',
          explanation: {
            why: 'Failing to close resources causes operating system file descriptor leaks and database connection pool exhaustion.',
            noncompliant: 'FileInputStream fis = new FileInputStream(file); byte[] data = fis.readAllBytes();',
            compliant: 'try (FileInputStream fis = new FileInputStream(file)) { byte[] data = fis.readAllBytes(); }',
          },
        });
      }

      // Rule: Raw generic types
      if (/\b(List|Map|Set|HashMap|ArrayList)\s+[a-zA-Z0-9_]+\s*=\s*new\s+\1/.test(trimmed)) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-raw`,
          ruleKey: 'java:S3740',
          ruleName: 'Raw types should not be used',
          message: 'Provide type arguments for this generic collection to guarantee compile-time type safety.',
          filePath,
          fileName,
          line: lineNum,
          column: 1,
          severity: 'MINOR',
          type: 'CODE_SMELL',
          effort: '2min',
          explanation: {
            why: 'Raw types bypass generic type checks, deferring unsafe type conversions and ClassCastException errors to runtime.',
            noncompliant: 'List list = new ArrayList();',
            compliant: 'List<VehicleDto> list = new ArrayList<>();',
          },
        });
      }

      // Rule: Thread.sleep
      if (/Thread\.sleep\(/.test(trimmed) && !filePath.includes('test')) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-sleep`,
          ruleKey: 'java:S2142',
          ruleName: '"InterruptedException" should not be ignored',
          message: 'Calling Thread.sleep without re-interrupting thread or proper backoff can stall thread pools.',
          filePath,
          fileName,
          line: lineNum,
          column: Math.max(1, lineText.indexOf('Thread.sleep') + 1),
          severity: 'MAJOR',
          type: 'CODE_SMELL',
          effort: '10min',
          explanation: {
            why: 'Direct Thread.sleep calls block worker threads and can degrade throughput under high concurrent load.',
            noncompliant: 'Thread.sleep(1000);',
            compliant: 'CompletableFuture.delayedExecutor(...);',
          },
        });
      }

      // Rule: @Transactional on non-public method
      if (/@Transactional/.test(trimmed) && (lines[idx + 1]?.includes('private ') || lines[idx + 1]?.includes('protected '))) {
        issues.push({
          id: `sonar-${filePath}-${lineNum}-trans`,
          ruleKey: 'java:S2230',
          ruleName: '"@Transactional" methods should be public',
          message: 'Spring @Transactional does not take effect on private or protected methods due to CGLIB/JDK proxy semantics.',
          filePath,
          fileName,
          line: lineNum,
          column: 1,
          severity: 'CRITICAL',
          type: 'BUG',
          effort: '10min',
          explanation: {
            why: 'Spring AOP transaction interception only intercepts calls to public methods. Annotating private methods gives a false sense of transaction boundary.',
            noncompliant: '@Transactional private void saveAudit() { ... }',
            compliant: '@Transactional public void saveAudit() { ... }',
          },
        });
      }
    }
  });

  return issues;
};

export const SonarToolWindow: React.FC<SonarToolWindowProps> = ({
  activeTab,
  currentProjectDirectory,
  onOpenFileAtLocation,
  onExecuteMavenGoal,
  onShowToast,
  onOpenSettings,
  onToggleMaximize,
  onHide,
  onAnalysisStateChange,
  targetScanPath,
  cancelSignal,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const cancelRequestedRef = React.useRef(false);
  const [issues, setIssues] = useState<SonarIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<SonarIssue | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUG' | 'VULNERABILITY' | 'CODE_SMELL' | 'SECURITY_HOTSPOT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabMode, setActiveTabMode] = useState<'findings' | 'log' | 'help'>('findings');
  const [viewMode, setViewMode] = useState<'rule' | 'location'>('rule');
  const [selectedPill, setSelectedPill] = useState<'ISSUES' | 'HOTSPOTS' | 'TAINT' | 'DEPRECATED' | 'ALL'>('ALL');

  // SonarQube Log history
  const [sonarLogs, setSonarLogs] = useState<Array<{ time: string; msg: string; level: 'info' | 'warn' | 'error' }>>([
    { time: new Date().toLocaleTimeString(), msg: 'SonarQube for IDE extension activated.', level: 'info' },
    { time: new Date().toLocaleTimeString(), msg: 'SonarJava & SonarJS Clean Code rule engines ready.', level: 'info' },
    { time: new Date().toLocaleTimeString(), msg: 'Connected Mode configuration loaded.', level: 'info' },
  ]);

  // Telemetry status
  const [telemetryMessage, setTelemetryMessage] = useState<string>('');

  // Server Connected Mode config
  const [sonarConfig, setSonarConfig] = useState<SonarServerConfig>(() => getSavedSonarConfig());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [serverChecking, setServerChecking] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [serverVersion, setServerVersion] = useState<string>('');

  // Auto-analyze active file on the fly
  useEffect(() => {
    if (activeTab?.content) {
      const detected = analyzeCodeForSonarIssues(activeTab.content, activeTab.path || activeTab.title);
      setIssues(detected);
      setSelectedIssue(detected[0] || null);
      setSonarLogs((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          msg: `Analyzed ${activeTab.title}: ${detected.length} findings detected.`,
          level: detected.length > 0 ? 'warn' : 'info',
        },
      ]);
    } else {
      setIssues([]);
      setSelectedIssue(null);
    }
  }, [activeTab?.path, activeTab?.content]);

  // Initial check of SonarQube Server status
  useEffect(() => {
    checkSonarServer(sonarConfig.serverUrl)
      .then(info => {
        setServerOnline(info.status === 'UP');
        setServerVersion(info.version);
      })
      .catch(() => {
        setServerOnline(false);
      });
  }, [sonarConfig.serverUrl]);

  // Stop running analysis
  const handleStopAnalysis = () => {
    cancelRequestedRef.current = true;
    setAnalyzing(false);
    onAnalysisStateChange?.(null);
    setTelemetryMessage('SonarQube analysis stopped.');
    onShowToast?.('SonarQube for IDE', 'Analysis stopped by user.', 'info');
  };

  // Watch external cancel signal
  useEffect(() => {
    if (cancelSignal && cancelSignal > 0) {
      handleStopAnalysis();
    }
  }, [cancelSignal]);

  // Phase 1: Local Single File Analysis
  const handleAnalyzeActiveFile = () => {
    if (!activeTab || !activeTab.content) {
      onShowToast?.('SonarQube for IDE', 'No active file open in editor to analyze.', 'info');
      return;
    }

    cancelRequestedRef.current = false;
    setAnalyzing(true);
    setTelemetryMessage(`Analyzing ${activeTab.title}...`);
    onAnalysisStateChange?.({
      isAnalyzing: true,
      message: 'SonarQube: Analyzing 1 file',
      filesCount: 1,
      currentFileName: activeTab.title,
      progressPercent: 30,
    });
    const startTime = performance.now();

    setTimeout(() => {
      if (cancelRequestedRef.current) {
        setAnalyzing(false);
        onAnalysisStateChange?.(null);
        return;
      }

      onAnalysisStateChange?.({
        isAnalyzing: true,
        message: 'SonarQube: Analyzing 1 file',
        filesCount: 1,
        currentFileName: activeTab.title,
        progressPercent: 70,
      });

      const detected = analyzeCodeForSonarIssues(activeTab.content || '', activeTab.path || activeTab.title);
      const elapsed = Math.round(performance.now() - startTime);

      setTimeout(() => {
        if (cancelRequestedRef.current) {
          setAnalyzing(false);
          onAnalysisStateChange?.(null);
          return;
        }

        setIssues(detected);
        setSelectedIssue(detected[0] || null);
        setAnalyzing(false);
        onAnalysisStateChange?.(null);
        const loc = (activeTab.content || '').split('\n').length;
        setTelemetryMessage(`Analyzed ${activeTab.title} (${loc} LOC) in ${elapsed}ms: ${detected.length} issue(s)`);
        setSonarLogs((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            msg: `Analyzed ${activeTab.title} (${loc} LOC): found ${detected.length} issue(s).`,
            level: detected.length > 0 ? 'warn' : 'info',
          },
        ]);
        onShowToast?.(
          'SonarQube Analysis Finished',
          `Analyzed ${activeTab.title}: found ${detected.length} issue(s)`,
          detected.length > 0 ? 'warning' : 'success'
        );
      }, 150);
    }, 250);
  };

  // Scan specific path or folder (from Context Menu or Keybinding)
  const handleScanPathOrFolder = async (targetPath: string, isFolder: boolean) => {
    cancelRequestedRef.current = false;
    setAnalyzing(true);
    setActiveTabMode('findings');

    const displayName = targetPath.replace(/\\/g, '/').split('/').pop() || targetPath;
    const startTime = performance.now();

    if (!isFolder) {
      setTelemetryMessage(`Analyzing ${displayName}...`);
      onAnalysisStateChange?.({
        isAnalyzing: true,
        message: 'SonarQube: Analyzing 1 file',
        filesCount: 1,
        currentFileName: displayName,
        progressPercent: 40,
      });

      try {
        let code = '';
        if (activeTab?.path === targetPath && activeTab.content) {
          code = activeTab.content;
        } else {
          code = await invoke<string>('read_file_content', { path: targetPath });
        }

        if (cancelRequestedRef.current) {
          setAnalyzing(false);
          onAnalysisStateChange?.(null);
          return;
        }

        const detected = analyzeCodeForSonarIssues(code, targetPath);
        const elapsed = Math.round(performance.now() - startTime);
        setIssues(detected);
        setSelectedIssue(detected[0] || null);
        setAnalyzing(false);
        onAnalysisStateChange?.(null);
        setTelemetryMessage(`Analyzed ${displayName} in ${elapsed}ms: ${detected.length} issue(s)`);
        setSonarLogs((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            msg: `Analyzed ${displayName}: found ${detected.length} issue(s).`,
            level: detected.length > 0 ? 'warn' : 'info',
          },
        ]);
        onShowToast?.(
          'SonarQube Analysis Finished',
          `Analyzed ${displayName}: found ${detected.length} issue(s)`,
          detected.length > 0 ? 'warning' : 'success'
        );
      } catch (err: any) {
        setAnalyzing(false);
        onAnalysisStateChange?.(null);
        setTelemetryMessage(`Failed to analyze ${displayName}: ${String(err)}`);
        onShowToast?.('Analysis Failed', String(err), 'error');
      }
    } else {
      // Folder scan
      setTelemetryMessage(`Scanning folder "${displayName}"...`);
      onAnalysisStateChange?.({
        isAnalyzing: true,
        message: `SonarQube: Scanning ${displayName}...`,
        progressPercent: 10,
      });

      try {
        const found = await invoke<Array<{ name: string; path: string; is_folder: boolean }>>('search_project_files', {
          projectPath: targetPath,
          query: '.',
          limit: 300,
        });

        const supportedFiles = found.filter(f => {
          if (f.is_folder) return false;
          const ext = f.name.split('.').pop()?.toLowerCase();
          return ext && ['java', 'vue', 'ts', 'tsx', 'js', 'jsx'].includes(ext);
        });

        if (supportedFiles.length === 0) {
          setAnalyzing(false);
          onAnalysisStateChange?.(null);
          setTelemetryMessage(`No source files (.java, .vue, .ts, .js) found in "${displayName}".`);
          onShowToast?.('SonarQube for IDE', `No analyzable files in ${displayName}`, 'info');
          return;
        }

        const allIssues: SonarIssue[] = [];
        let totalLoc = 0;

        for (let i = 0; i < supportedFiles.length; i++) {
          if (cancelRequestedRef.current) {
            setTelemetryMessage(`Analysis canceled by user (${i}/${supportedFiles.length} files scanned).`);
            break;
          }

          const file = supportedFiles[i];
          const percent = Math.round(((i + 1) / supportedFiles.length) * 100);
          onAnalysisStateChange?.({
            isAnalyzing: true,
            message: `SonarQube: Analyzing ${i + 1} of ${supportedFiles.length} files`,
            filesCount: supportedFiles.length,
            currentFileName: file.name,
            progressPercent: percent,
          });

          try {
            const content = await invoke<string>('read_file_content', { path: file.path });
            totalLoc += content.split('\n').length;
            const detected = analyzeCodeForSonarIssues(content, file.path);
            allIssues.push(...detected);
          } catch (e) {
            console.warn('Failed to read file for Sonar analysis:', file.path, e);
          }

          // Small yield to let UI re-render progress
          if (i % 3 === 0) {
            await new Promise(r => setTimeout(r, 10));
          }
        }

        const elapsed = Math.round(performance.now() - startTime);
        setIssues(allIssues);
        setSelectedIssue(allIssues[0] || null);
        setAnalyzing(false);
        onAnalysisStateChange?.(null);

        const statusMsg = cancelRequestedRef.current 
          ? `Analysis stopped: found ${allIssues.length} issues in scanned files.`
          : `Scanned ${supportedFiles.length} files (${totalLoc.toLocaleString()} LOC) in ${elapsed}ms: found ${allIssues.length} issues.`;
        setTelemetryMessage(statusMsg);
        onShowToast?.(
          'SonarQube Analysis Finished',
          `Scanned ${supportedFiles.length} files: ${allIssues.length} issue(s) found.`,
          allIssues.length > 0 ? 'warning' : 'success'
        );
      } catch (err: any) {
        setAnalyzing(false);
        onAnalysisStateChange?.(null);
        setTelemetryMessage(`Folder scan failed: ${String(err)}`);
        onShowToast?.('Scan Failed', String(err), 'error');
      }
    }
  };

  // Listen to targetScanPath changes
  useEffect(() => {
    if (targetScanPath && targetScanPath.path) {
      handleScanPathOrFolder(targetScanPath.path, targetScanPath.isFolder);
    }
  }, [targetScanPath?.timestamp]);

  // Phase 1 & 2: Project-wide static analysis (Scan all Java files in project)
  const handleScanProjectFiles = async () => {
    setAnalyzing(true);
    setTelemetryMessage('Scanning project for Java files...');
    const startTime = performance.now();

    try {
      // Find all Java files via Tauri search_project_files
      const files = await invoke<Array<{ name: string; path: string; is_folder: boolean }>>('search_project_files', {
        projectPath: currentProjectDirectory || 'D:\\mic-be\\mic-vehicles',
        query: '.java',
        limit: 300,
      });

      const javaFiles = files.filter(f => !f.is_folder && f.path.endsWith('.java'));
      if (javaFiles.length === 0) {
        setAnalyzing(false);
        setTelemetryMessage('No Java source files found in the current project.');
        onShowToast?.('SonarLint', 'No Java source files found to scan.', 'info');
        return;
      }

      setTelemetryMessage(`Analyzing ${javaFiles.length} Java source files across project...`);
      let totalLoc = 0;
      const allIssues: SonarIssue[] = [];

      for (const jf of javaFiles) {
        try {
          const content = await invoke<string>('read_file_content', { path: jf.path });
          totalLoc += content.split('\n').length;
          const detected = analyzeCodeForSonarIssues(content, jf.path);
          allIssues.push(...detected);
        } catch (e) {
          console.warn(`Failed to read file ${jf.path}:`, e);
        }
      }

      const elapsed = Math.round(performance.now() - startTime);
      setIssues(allIssues);
      setSelectedIssue(allIssues[0] || null);
      setActiveTabMode('findings');
      setAnalyzing(false);
      setTelemetryMessage(`Scanned ${javaFiles.length} Java files (${totalLoc.toLocaleString()} LOC) in ${elapsed}ms: found ${allIssues.length} issues.`);
      onShowToast?.(
        'Project Quality Gate Scan Finished',
        `Scanned ${javaFiles.length} files: ${allIssues.length} issue(s) found.`,
        allIssues.length > 0 ? 'warning' : 'success'
      );
    } catch (err: any) {
      setAnalyzing(false);
      setTelemetryMessage(`Scan failed: ${String(err)}`);
      onShowToast?.('Scan Failed', String(err), 'error');
    }
  };

  // Phase 3: Fetch issues from remote SonarQube Server (https://sonar-dev-bpm.mic.vn)
  const handleFetchFromServer = async () => {
    setAnalyzing(true);
    setTelemetryMessage(`Connecting to SonarQube server ${sonarConfig.serverUrl}...`);

    try {
      const qg = await fetchSonarQualityGate(sonarConfig.serverUrl, sonarConfig.projectKey, sonarConfig.token);
      const remoteIssues = await fetchSonarIssues(sonarConfig.serverUrl, sonarConfig.projectKey, sonarConfig.token);

      const mapped: SonarIssue[] = remoteIssues.map(r => ({
        id: r.key,
        ruleKey: r.rule,
        ruleName: r.message,
        message: r.message,
        filePath: r.component,
        fileName: r.component.split(':').pop() || r.component,
        line: r.line || 1,
        column: 1,
        severity: r.severity,
        type: r.type,
        effort: r.effort || '10min',
        isRemote: true,
        explanation: {
          why: `This rule (${r.rule}) was reported by SonarQube Server (${sonarConfig.serverUrl}) for project ${sonarConfig.projectKey}.`,
          noncompliant: '// Reported by SonarQube Server',
          compliant: '// Remediate code according to SonarQube Clean Code guidelines',
        },
      }));

      setIssues(mapped);
      setSelectedIssue(mapped[0] || null);
      setActiveTabMode('findings');
      setAnalyzing(false);
      setTelemetryMessage(`SonarQube (${sonarConfig.serverUrl}): Quality Gate ${qg.status} • Loaded ${mapped.length} remote issues.`);
      onShowToast?.(
        'SonarQube Sync Complete',
        `Quality Gate: ${qg.status}. Loaded ${mapped.length} issue(s) from server.`,
        qg.status === 'OK' ? 'success' : 'warning'
      );
    } catch (err: any) {
      setAnalyzing(false);
      setTelemetryMessage(`SonarQube Error: ${String(err)}`);
      onShowToast?.('SonarQube Fetch Failed', String(err), 'error');
    }
  };

  // Auto-analyze active file on open/tab change if in findings mode
  useEffect(() => {
    if (activeTabMode === 'findings' && activeTab?.content) {
      const detected = analyzeCodeForSonarIssues(activeTab.content, activeTab.path || activeTab.title);
      setIssues(detected);
      setSelectedIssue(detected[0] || null);
      setTelemetryMessage(`Analyzed ${activeTab.title} (${activeTab.content.split('\n').length} LOC): ${detected.length} issues`);
    }
  }, [activeTab?.path, activeTab?.content, activeTabMode]);

  const counts = useMemo(() => {
    return {
      issues: issues.filter(i => i.type === 'BUG' || i.type === 'CODE_SMELL').length,
      hotspots: issues.filter(i => i.type === 'SECURITY_HOTSPOT').length,
      taint: issues.filter(i => i.type === 'VULNERABILITY').length,
      deprecated: 0,
      bugs: issues.filter(i => i.type === 'BUG').length,
      vulnerabilities: issues.filter(i => i.type === 'VULNERABILITY').length,
      codeSmells: issues.filter(i => i.type === 'CODE_SMELL').length,
      blockers: issues.filter(i => i.severity === 'BLOCKER').length,
    };
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Pill filter
      if (selectedPill === 'ISSUES') {
        if (issue.type === 'SECURITY_HOTSPOT' || issue.type === 'VULNERABILITY') return false;
      } else if (selectedPill === 'HOTSPOTS') {
        if (issue.type !== 'SECURITY_HOTSPOT') return false;
      } else if (selectedPill === 'TAINT') {
        if (issue.type !== 'VULNERABILITY') return false;
      } else if (selectedPill === 'DEPRECATED') {
        return false;
      }

      if (severityFilter !== 'ALL' && issue.severity !== severityFilter) return false;
      if (typeFilter !== 'ALL' && issue.type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          issue.message.toLowerCase().includes(q) ||
          issue.ruleKey.toLowerCase().includes(q) ||
          issue.ruleName.toLowerCase().includes(q) ||
          issue.fileName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [issues, selectedPill, severityFilter, typeFilter, searchQuery]);

  // Group issues by RuleKey for "RULE" view mode
  const issuesByRule = useMemo(() => {
    const map = new Map<string, { ruleKey: string; ruleName: string; type: SonarIssue['type']; severity: SonarIssue['severity']; items: SonarIssue[] }>();
    for (const issue of filteredIssues) {
      const existing = map.get(issue.ruleKey);
      if (existing) {
        existing.items.push(issue);
      } else {
        map.set(issue.ruleKey, {
          ruleKey: issue.ruleKey,
          ruleName: issue.ruleName,
          type: issue.type,
          severity: issue.severity,
          items: [issue],
        });
      }
    }
    return map;
  }, [filteredIssues]);

  // Group issues by file location for "LOCATION" view mode
  const issuesByLocation = useMemo(() => {
    const map = new Map<string, SonarIssue[]>();
    for (const issue of filteredIssues) {
      const list = map.get(issue.fileName) || [];
      list.push(issue);
      map.set(issue.fileName, list);
    }
    return map;
  }, [filteredIssues]);

  const getSeverityBadge = (sev: SonarIssue['severity']) => {
    switch (sev) {
      case 'BLOCKER':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E05555]/20 text-[#E05555] border border-[#E05555]/30">BLOCKER</span>;
      case 'CRITICAL':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FF8800]/20 text-[#FF8800] border border-[#FF8800]/30">CRITICAL</span>;
      case 'MAJOR':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EDA200]/20 text-[#EDA200] border border-[#EDA200]/30">MAJOR</span>;
      case 'MINOR':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#3574F0]/20 text-[#85B1F8] border border-[#3574F0]/30">MINOR</span>;
      case 'INFO':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#868A91]/20 text-[#868A91] border border-[#868A91]/30">INFO</span>;
    }
  };

  const getTypeIcon = (type: SonarIssue['type']) => {
    switch (type) {
      case 'BUG':
        return <Bug size={14} className="text-[#E05555] shrink-0" />;
      case 'VULNERABILITY':
        return <ShieldAlert size={14} className="text-[#FF8800] shrink-0" />;
      case 'CODE_SMELL':
        return <Zap size={14} className="text-[#3574F0] shrink-0" />;
      case 'SECURITY_HOTSPOT':
        return <Flame size={14} className="text-[#EDA200] shrink-0" />;
    }
  };

  const handleTestConnection = async () => {
    setServerChecking(true);
    try {
      const info = await checkSonarServer(sonarConfig.serverUrl);
      setServerOnline(info.status === 'UP');
      setServerVersion(info.version);
      onShowToast?.('SonarQube Connected', `Server is UP (version ${info.version})`, 'success');
    } catch (e: any) {
      setServerOnline(false);
      onShowToast?.('SonarQube Connection Failed', String(e), 'error');
    } finally {
      setServerChecking(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1F22] text-[#DFE1E5] select-none text-xs">
      {/* 1. IntelliJ Top Tab Bar (28px height) */}
      <div className="h-7 bg-[#1E1F22] border-b border-[#2B2D30] px-2 flex items-center justify-between text-[11px] select-none flex-shrink-0">
        {/* Left Side: Brand Icon & 3 Tabs (Findings, Log, Help & Feedback) */}
        <div className="flex items-center gap-1 h-full">
          <div className="flex items-center gap-1.5 px-1.5 text-white font-medium mr-1">
            <SonarIcon size={14} />
            <span className="font-semibold text-xs">SonarQube for IDE</span>
          </div>

          <div className="h-3.5 w-[1px] bg-[#2B2D30] mx-0.5" />

          {/* Tabs: Findings, Log, Help & Feedback */}
          <div className="flex items-center gap-0.5 h-full">
            <button
              onClick={() => {
                setActiveTabMode('findings');
                if (activeTab?.content) {
                  const detected = analyzeCodeForSonarIssues(activeTab.content, activeTab.path || activeTab.title);
                  setIssues(detected);
                  setSelectedIssue(detected[0] || null);
                }
              }}
              className={`px-2.5 h-[26px] flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] border-b-2 ${
                activeTabMode === 'findings'
                  ? 'border-[#3574F0] text-[#DFE1E5] font-medium'
                  : 'border-transparent text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/50'
              }`}
            >
              <span>Findings</span>
            </button>

            <button
              onClick={() => setActiveTabMode('log')}
              className={`px-2.5 h-[26px] flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] border-b-2 ${
                activeTabMode === 'log'
                  ? 'border-[#3574F0] text-[#DFE1E5] font-medium'
                  : 'border-transparent text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/50'
              }`}
            >
              <span>Log</span>
            </button>

            <button
              onClick={() => setActiveTabMode('help')}
              className={`px-2.5 h-[26px] flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] border-b-2 ${
                activeTabMode === 'help'
                  ? 'border-[#3574F0] text-[#DFE1E5] font-medium'
                  : 'border-transparent text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]/50'
              }`}
            >
              <span>Help & Feedback</span>
            </button>
          </div>
        </div>

        {/* Right Side: Maven Sonar, Window Controls */}
        <div className="flex items-center gap-1 text-[#868A91]">
          {/* Optional Maven goal */}
          {onExecuteMavenGoal && (
            <button
              onClick={() => onExecuteMavenGoal(buildMavenSonarCommand(sonarConfig))}
              className="px-2 py-0.5 rounded bg-[#4B9FD5]/15 hover:bg-[#4B9FD5]/25 text-[#4B9FD5] text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ml-1"
              title={`Run '${buildMavenSonarCommand(sonarConfig)}'`}
            >
              <Terminal size={11} />
              <span>mvn sonar:sonar</span>
            </button>
          )}

          <div className="h-3 w-[1px] bg-[#2B2D30] mx-1" />

          {/* Window maximize & hide */}
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
              title="Maximize tool window"
            >
              <Maximize2 size={12} />
            </button>
          )}
          {onHide && (
            <button
              onClick={onHide}
              className="p-1 rounded hover:bg-[#2B2D30] text-[#868A91] hover:text-[#DFE1E5] transition-colors cursor-pointer"
              title="Hide Window"
            >
              <Minus size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Content Router */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* TAB: Findings */}
        {activeTabMode === 'findings' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left Vertical Action Strip (Matching IntelliJ SonarQube panel) */}
            <div className="w-8 border-r border-[#2B2D30] bg-[#1E1F22] flex flex-col items-center py-2 gap-1.5 flex-shrink-0 select-none">
              {/* Play / Run Analysis */}
              <button
                onClick={handleAnalyzeActiveFile}
                disabled={analyzing}
                className="w-6 h-6 rounded flex items-center justify-center text-[#59A869] hover:bg-[#2B2D30] transition-colors cursor-pointer"
                title="Analyze active file with Sonar rules"
              >
                <Play size={13} className="fill-[#59A869]" />
              </button>

              {/* Stop Analysis Button (Matching IntelliJ Red Stop ⏹) */}
              <button
                onClick={handleStopAnalysis}
                disabled={!analyzing}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                  analyzing 
                    ? 'text-[#E05555] hover:bg-[#E05555]/20 cursor-pointer' 
                    : 'text-[#55575C] cursor-not-allowed opacity-40'
                }`}
                title={analyzing ? "Stop SonarQube analysis" : "Stop"}
              >
                <div className={`w-2.5 h-2.5 rounded-[1px] ${analyzing ? 'bg-[#E05555]' : 'bg-[#55575C]'}`} />
              </button>

              {/* Filter findings */}
              <button
                onClick={() => setSelectedPill(prev => prev === 'ALL' ? 'ISSUES' : 'ALL')}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                  selectedPill !== 'ALL' ? 'text-[#3574F0] bg-[#3574F0]/20' : 'text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30]'
                }`}
                title="Filter findings"
              >
                <Filter size={13} />
              </button>

              {/* Group By Rule / Location */}
              <button
                onClick={() => setViewMode(prev => prev === 'rule' ? 'location' : 'rule')}
                className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30] transition-colors cursor-pointer"
                title={`Grouping by: ${viewMode === 'rule' ? 'Rule' : 'Location'}`}
              >
                <Layers size={13} />
              </button>

              <div className="w-4 h-[1px] bg-[#2B2D30] my-0.5" />

              {/* Settings */}
              <button
                onClick={() => {
                  if (onOpenSettings) onOpenSettings();
                  else setShowConfigModal(true);
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30] transition-colors cursor-pointer"
                title="SonarQube for IDE Settings"
              >
                <SettingsIcon size={13} />
              </button>
            </div>

            {/* Right container: Ribbon + Split view + Footer */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Top Filter Ribbon */}
              <div className="h-8 border-b border-[#2B2D30] px-3 bg-[#1E1F22] flex items-center justify-between text-[11px] flex-shrink-0">
                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedPill(prev => prev === 'ISSUES' ? 'ALL' : 'ISSUES')}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight border transition-all cursor-pointer ${
                      selectedPill === 'ISSUES'
                        ? 'bg-[#3574F0]/20 text-[#85B1F8] border-[#3574F0]'
                        : 'bg-[#2B2D30]/60 text-[#DFE1E5] border-[#393B40] hover:border-[#4B9FD5]/60'
                    }`}
                  >
                    [ {counts.issues} ISSUES ]
                  </button>

                  <button
                    onClick={() => setSelectedPill(prev => prev === 'HOTSPOTS' ? 'ALL' : 'HOTSPOTS')}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight border transition-all cursor-pointer ${
                      selectedPill === 'HOTSPOTS'
                        ? 'bg-[#EDA200]/20 text-[#EDA200] border-[#EDA200]'
                        : 'bg-[#2B2D30]/60 text-[#DFE1E5] border-[#393B40] hover:border-[#EDA200]/60'
                    }`}
                  >
                    [ {counts.hotspots} SECURITY HOTSPOTS ]
                  </button>

                  <button
                    onClick={() => setSelectedPill(prev => prev === 'TAINT' ? 'ALL' : 'TAINT')}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight border transition-all cursor-pointer ${
                      selectedPill === 'TAINT'
                        ? 'bg-[#FF8800]/20 text-[#FF8800] border-[#FF8800]'
                        : 'bg-[#2B2D30]/60 text-[#DFE1E5] border-[#393B40] hover:border-[#FF8800]/60'
                    }`}
                  >
                    [ {counts.taint} TAINT VULNERABILITIES ]
                  </button>

                  <button
                    onClick={() => setSelectedPill(prev => prev === 'DEPRECATED' ? 'ALL' : 'DEPRECATED')}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight border transition-all cursor-pointer ${
                      selectedPill === 'DEPRECATED'
                        ? 'bg-[#868A91]/30 text-white border-[#868A91]'
                        : 'bg-[#2B2D30]/60 text-[#868A91] border-[#393B40]'
                    }`}
                  >
                    [ DEPRECATED RULES ]
                  </button>

                  <button
                    onClick={() => setActiveTabMode('help')}
                    className="w-5 h-5 rounded-full flex items-center justify-center bg-[#2B2D30]/60 border border-[#393B40] text-[#868A91] hover:text-white transition-colors cursor-pointer text-[10px] font-semibold"
                    title="What is this?"
                  >
                    ?
                  </button>
                </div>

                {/* Right side: Rule | Locations tabs with underline */}
                <div className="flex items-center gap-4 h-full pr-2">
                  <div className="flex items-center gap-3 h-full">
                    <button
                      onClick={() => setViewMode('rule')}
                      className={`h-full flex items-center text-[12px] font-medium transition-colors cursor-pointer border-b-2 ${
                        viewMode === 'rule'
                          ? 'border-[#3574F0] text-[#DFE1E5]'
                          : 'border-transparent text-[#868A91] hover:text-[#DFE1E5]'
                      }`}
                    >
                      Rule
                    </button>
                    <button
                      onClick={() => setViewMode('location')}
                      className={`h-full flex items-center text-[12px] font-medium transition-colors cursor-pointer border-b-2 ${
                        viewMode === 'location'
                          ? 'border-[#3574F0] text-[#DFE1E5]'
                          : 'border-transparent text-[#868A91] hover:text-[#DFE1E5]'
                      }`}
                    >
                      Locations
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Split Area (Findings Tree & Rule Description) */}
              <div className="flex-1 flex min-h-0">
                {/* Left Pane */}
                <div className="w-[50%] border-r border-[#2B2D30] flex flex-col overflow-y-auto bg-[#1E1F22]">
                  {filteredIssues.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[#868A91] text-xs">
                      No findings to display
                    </div>
                  ) : (
                    <div className="divide-y divide-[#2B2D30]/60">
                      {viewMode === 'rule' ? (
                        /* Grouped by Rule */
                        Array.from(issuesByRule.values()).map(group => (
                          <div key={group.ruleKey} className="bg-[#1E1F22]">
                            {/* Rule Header */}
                            <div className="px-3 py-1.5 bg-[#25272B] text-[11px] font-medium text-[#DFE1E5] flex items-center justify-between border-b border-[#2B2D30]">
                              <div className="flex items-center gap-2 truncate">
                                {getTypeIcon(group.type)}
                                <span className="font-mono text-[#85B1F8] font-semibold">{group.ruleKey}</span>
                                <span className="truncate text-[#DFE1E5]">{group.ruleName}</span>
                              </div>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#3574F0]/20 text-[#85B1F8]">
                                {group.items.length}
                              </span>
                            </div>

                            {/* Rule Occurrences */}
                            <div className="divide-y divide-[#2B2D30]/40">
                              {group.items.map(issue => {
                                const isSelected = selectedIssue?.id === issue.id;
                                return (
                                  <div
                                    key={issue.id}
                                    onClick={() => {
                                      setSelectedIssue(issue);
                                      onOpenFileAtLocation(issue.filePath, issue.line, issue.column);
                                    }}
                                    className={`p-2.5 pl-6 flex items-start gap-2 cursor-pointer transition-colors ${
                                      isSelected ? 'bg-[#2E436E]/70 border-l-2 border-[#3574F0]' : 'hover:bg-[#2B2D30]/50'
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-white truncate">{issue.message}</div>
                                      <div className="flex items-center gap-2 mt-1 text-[10.5px] text-[#868A91]">
                                        <span className="hover:underline flex items-center gap-1 text-[#C4C7C5]">
                                          <FileCode size={10} />
                                          {issue.fileName}:{issue.line}
                                        </span>
                                        <span>•</span>
                                        <span>{issue.effort}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      ) : (
                        /* Grouped by Location */
                        Array.from(issuesByLocation.entries()).map(([fileName, fileIssues]) => (
                          <div key={fileName} className="bg-[#1E1F22]">
                            {/* Location Header */}
                            <div className="px-3 py-1.5 bg-[#25272B] text-[11px] font-medium text-[#DFE1E5] flex items-center justify-between border-b border-[#2B2D30]">
                              <div className="flex items-center gap-1.5 truncate">
                                <FileCode size={13} className="text-[#4B9FD5] shrink-0" />
                                <span className="truncate">{fileName}</span>
                              </div>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#3574F0]/20 text-[#85B1F8]">
                                {fileIssues.length}
                              </span>
                            </div>

                            {/* Location Occurrences */}
                            <div className="divide-y divide-[#2B2D30]/40">
                              {fileIssues.map(issue => {
                                const isSelected = selectedIssue?.id === issue.id;
                                return (
                                  <div
                                    key={issue.id}
                                    onClick={() => {
                                      setSelectedIssue(issue);
                                      onOpenFileAtLocation(issue.filePath, issue.line, issue.column);
                                    }}
                                    className={`p-2.5 pl-6 flex items-start gap-2.5 cursor-pointer transition-colors ${
                                      isSelected ? 'bg-[#2E436E]/70 border-l-2 border-[#3574F0]' : 'hover:bg-[#2B2D30]/50'
                                    }`}
                                  >
                                    <div className="mt-0.5">{getTypeIcon(issue.type)}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs text-white truncate">{issue.message}</div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          {getSeverityBadge(issue.severity)}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1 text-[10.5px] text-[#868A91]">
                                        <span className="font-mono text-[#85B1F8]">{issue.ruleKey}</span>
                                        <span>•</span>
                                        <span>Line {issue.line}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Right Pane: Rule Description & Solution */}
                <div className="flex-1 flex flex-col overflow-y-auto bg-[#1E1F22] p-4 text-xs">
                  {selectedIssue && filteredIssues.length > 0 ? (
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="border-b border-[#2B2D30] pb-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          {getTypeIcon(selectedIssue.type)}
                          <span className="font-mono text-xs font-bold text-[#85B1F8]">{selectedIssue.ruleKey}</span>
                          {getSeverityBadge(selectedIssue.severity)}
                          <span className="text-[10px] text-[#868A91] px-1.5 py-0.5 rounded bg-[#2B2D30] border border-[#393B40]">
                            {selectedIssue.type.replace('_', ' ')}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-white">{selectedIssue.ruleName}</h3>
                        <div className="text-[11px] text-[#868A91] mt-1.5">
                          Location: <span className="font-mono text-[#DFE1E5]">{selectedIssue.fileName} (line {selectedIssue.line}, col {selectedIssue.column})</span>
                        </div>
                      </div>

                      {/* Why is this an issue? */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#DFE1E5] uppercase tracking-wide flex items-center gap-1.5">
                          <AlertCircle size={13} className="text-[#3574F0]" />
                          <span>Why is this an issue?</span>
                        </div>
                        <p className="text-xs text-[#C4C7C5] leading-relaxed bg-[#25272B] p-2.5 rounded border border-[#393B40]">
                          {selectedIssue.explanation.why}
                        </p>
                      </div>

                      {/* Noncompliant Code Example */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#E05555] uppercase tracking-wide flex items-center gap-1.5">
                          <AlertTriangle size={13} />
                          <span>Noncompliant Code Example</span>
                        </div>
                        <div className="p-2.5 rounded bg-[#18191B] border border-[#E05555]/30 font-mono text-[11px] text-[#E05555] leading-relaxed overflow-x-auto">
                          <code>{selectedIssue.explanation.noncompliant}</code>
                        </div>
                      </div>

                      {/* Compliant Solution */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#59A869] uppercase tracking-wide flex items-center gap-1.5">
                          <CheckCircle2 size={13} />
                          <span>Compliant Solution</span>
                        </div>
                        <div className="p-2.5 rounded bg-[#18191B] border border-[#59A869]/30 font-mono text-[11px] text-[#59A869] leading-relaxed overflow-x-auto">
                          <code>{selectedIssue.explanation.compliant}</code>
                        </div>
                      </div>

                      {/* Jump Button */}
                      <div className="pt-2">
                        <button
                          onClick={() => onOpenFileAtLocation(selectedIssue.filePath, selectedIssue.line, selectedIssue.column)}
                          className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <FileCode size={13} />
                          <span>Navigate to Code Line {selectedIssue.line}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#868A91] text-xs">
                      Select a finding to display the rule description
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Bar */}
              <div className="h-6 border-t border-[#2B2D30] px-3 bg-[#18191B] flex items-center justify-between text-[11px] text-[#868A91] flex-shrink-0">
                <span 
                  onClick={handleAnalyzeActiveFile}
                  className="hover:text-[#DFE1E5] hover:underline cursor-pointer"
                >
                  Automatic analysis is enabled
                </span>
                <span 
                  onClick={() => setActiveTabMode('help')}
                  className="hover:text-[#DFE1E5] hover:underline cursor-pointer flex items-center gap-1"
                >
                  What is in this view <Info size={11} />
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Log */}
        {activeTabMode === 'log' && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#18191B]">
            <div className="h-8 border-b border-[#2B2D30] px-3 flex items-center justify-between bg-[#1E1F22] flex-shrink-0">
              <div className="flex items-center gap-2 text-xs font-medium text-[#DFE1E5]">
                <span>SonarQube Analysis Log</span>
                <span className="text-[10px] text-[#868A91]">({sonarLogs.length} entries)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const text = sonarLogs.map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.msg}`).join('\n');
                    navigator.clipboard.writeText(text);
                    onShowToast?.('Copied', 'Analysis log copied to clipboard.', 'info');
                  }}
                  className="px-2 py-0.5 rounded text-[11px] bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] flex items-center gap-1 border border-[#393B40] transition-colors cursor-pointer"
                >
                  <Copy size={11} />
                  <span>Copy Log</span>
                </button>
                <button
                  onClick={() => setSonarLogs([])}
                  className="px-2 py-0.5 rounded text-[11px] bg-[#2B2D30] hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] border border-[#393B40] transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1 select-text">
              {sonarLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[#868A91] shrink-0">[{log.time}]</span>
                  <span className={`shrink-0 font-bold ${
                    log.level === 'error' ? 'text-[#E05555]' : log.level === 'warn' ? 'text-[#EDA200]' : 'text-[#3574F0]'
                  }`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="text-[#DFE1E5] break-all">{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Help & Feedback */}
        {activeTabMode === 'help' && (
          <div className="flex-1 overflow-y-auto p-6 bg-[#1E1F22] text-[#DFE1E5] space-y-6 max-w-4xl">
            <div className="flex items-center gap-3 border-b border-[#2B2D30] pb-4">
              <SonarIcon size={28} />
              <div>
                <h2 className="text-base font-semibold text-white">SonarQube for IDE (IntelliJ Edition)</h2>
                <p className="text-xs text-[#868A91] mt-0.5">
                  Clean Code static analysis engine with Clean as You Code methodology.
                </p>
              </div>
            </div>

            {/* Clean Code Taxonomy */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase text-white tracking-wider">
                Clean Code Software Qualities
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#25272B] p-3 rounded border border-[#393B40]">
                  <div className="font-semibold text-xs text-[#4B9FD5] mb-1">Consistency</div>
                  <div className="text-[11px] text-[#C4C7C5] leading-relaxed">
                    Code is uniform, standardized, and matches project formatting and naming conventions.
                  </div>
                </div>

                <div className="bg-[#25272B] p-3 rounded border border-[#393B40]">
                  <div className="font-semibold text-xs text-[#59A869] mb-1">Intentionality</div>
                  <div className="text-[11px] text-[#C4C7C5] leading-relaxed">
                    Clear semantic purpose with no unused variables, dead code, or misleading constructs.
                  </div>
                </div>

                <div className="bg-[#25272B] p-3 rounded border border-[#393B40]">
                  <div className="font-semibold text-xs text-[#EDA200] mb-1">Adaptability</div>
                  <div className="text-[11px] text-[#C4C7C5] leading-relaxed">
                    Easy to maintain, evolve, and test with loose coupling and high cohesion.
                  </div>
                </div>

                <div className="bg-[#25272B] p-3 rounded border border-[#393B40]">
                  <div className="font-semibold text-xs text-[#E05555] mb-1">Responsibility</div>
                  <div className="text-[11px] text-[#C4C7C5] leading-relaxed">
                    Secure, robust error handling, proper resource management, and no vulnerabilities.
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Mode Actions */}
            <div className="bg-[#25272B] p-4 rounded border border-[#393B40] space-y-3">
              <h3 className="text-xs font-semibold text-white">Connected Mode to SonarQube Server / Cloud</h3>
              <p className="text-xs text-[#868A91] leading-relaxed">
                Bind your project to your organization's SonarQube server to synchronize Quality Profiles, active rules, and Quality Gate notifications directly in your IDE.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => {
                    if (onOpenSettings) onOpenSettings();
                    else setShowConfigModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <SettingsIcon size={12} />
                  <span>Configure Connected Mode in Settings</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SonarQube Quick Configuration Modal */}
      {showConfigModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
          onClick={() => setShowConfigModal(false)}
        >
          <div 
            className="w-[480px] bg-[#2B2D30] border border-[#43454A] rounded-lg shadow-2xl overflow-hidden text-[#DFE1E5]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-9 bg-[#26282B] border-b border-[#393B40] px-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SonarIcon size={16} />
                <span className="text-xs font-semibold text-white">SonarQube Server Configuration</span>
              </div>
              <button 
                onClick={() => setShowConfigModal(false)} 
                className="p-1 text-[#868A91] hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div>
                <label className="text-[#868A91] block mb-1">SonarQube Server URL:</label>
                <input
                  type="text"
                  value={sonarConfig.serverUrl}
                  onChange={(e) => setSonarConfig(prev => ({ ...prev, serverUrl: e.target.value }))}
                  placeholder="https://sonar-dev-bpm.mic.vn"
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-[#868A91] block mb-1">Project Key:</label>
                <input
                  type="text"
                  value={sonarConfig.projectKey}
                  onChange={(e) => setSonarConfig(prev => ({ ...prev, projectKey: e.target.value }))}
                  placeholder="mic-vehicles"
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-[#868A91] block mb-1">User Authentication Token (Optional if public):</label>
                <input
                  type="password"
                  value={sonarConfig.token || ''}
                  onChange={(e) => setSonarConfig(prev => ({ ...prev, token: e.target.value }))}
                  placeholder="sqp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 text-white font-mono outline-none"
                />
                <p className="text-[10.5px] text-[#868A91] mt-1">
                  Generate token in SonarQube: My Account &gt; Security &gt; Generate Tokens.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#393B40]">
                <button
                  onClick={handleTestConnection}
                  disabled={serverChecking}
                  className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] rounded border border-[#393B40] flex items-center gap-1.5 cursor-pointer"
                >
                  {serverChecking ? <RefreshCw size={12} className="animate-spin" /> : null}
                  <span>Test Connection</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfigModal(false)}
                    className="px-3 py-1.5 bg-[#2B2D30] hover:bg-[#35373B] text-[#868A91] rounded border border-[#393B40]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      saveSonarConfig(sonarConfig);
                      setShowConfigModal(false);
                      onShowToast?.('Settings Saved', 'SonarQube server configuration updated.', 'success');
                    }}
                    className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white font-medium rounded"
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
