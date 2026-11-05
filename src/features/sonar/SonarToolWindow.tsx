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
  X
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

interface SonarToolWindowProps {
  activeTab?: OpenTab;
  currentProjectDirectory: string;
  onOpenFileAtLocation: (filePath: string, line: number, col?: number) => void;
  onExecuteMavenGoal?: (goal: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SonarIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke="#4B9FD5" strokeWidth="2" />
    <path d="M12 6C8.68629 6 6 8.68629 6 12C6 13.6569 6.67157 15.1569 7.75736 16.2426" stroke="#4B9FD5" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 9C10.3431 9 9 10.3431 9 12" stroke="#4B9FD5" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="1.5" fill="#4B9FD5" />
  </svg>
);

export const analyzeCodeForSonarIssues = (code: string, filePath: string): SonarIssue[] => {
  const issues: SonarIssue[] = [];
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() || 'File';
  const lines = code.split('\n');

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const trimmed = lineText.trim();

    // Rule 1: Java string equality using == instead of .equals()
    if (trimmed.includes('==') && (trimmed.includes('"') || trimmed.includes('String') || /==\s*[a-zA-Z0-9_]+\.get[A-Z]/.test(trimmed))) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-1`,
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

    // Rule 2: Hardcoded credentials / passwords / secret keys
    if (/(password|secret|token|api[_-]?key|passwd)\s*[:=]\s*["'][^"']{4,}["']/i.test(trimmed) && !trimmed.includes('System.getenv') && !trimmed.includes('${') && !trimmed.includes('properties')) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-2`,
        ruleKey: 'java:S2068',
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
          noncompliant: 'String dbPassword = "SuperSecret123!";',
          compliant: 'String dbPassword = System.getenv("DB_PASSWORD");',
        },
      });
    }

    // Rule 3: System.out.println / System.err.println in production code
    if (/System\.(out|err)\.(print|println|printf)/.test(trimmed)) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-3`,
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

    // Rule 4: Empty catch block
    if (/catch\s*\([^)]+\)\s*\{\s*\}/.test(trimmed) || (trimmed.startsWith('catch') && lines[idx + 1]?.trim() === '}')) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-4`,
        ruleKey: 'java:S2486',
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
          noncompliant: 'try { doSomething(); } catch (Exception e) {}',
          compliant: 'try { doSomething(); } catch (Exception e) { log.error("Failed to execute", e); }',
        },
      });
    }

    // Rule 5: Spring Boot @Autowired on field (Field Injection is not recommended)
    if (/@Autowired\s*(private|protected|public)?\s+[A-Z][a-zA-Z0-9_<>]+/.test(trimmed) || (trimmed === '@Autowired' && lines[idx + 1] && !lines[idx + 1].includes('('))) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-5`,
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

    // Rule 6: SQL Injection concatenation risk
    if (/(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b.*["']\s*\+\s*[a-zA-Z0-9_.]+/i.test(trimmed) && (trimmed.includes('Query') || trimmed.includes('sql') || trimmed.includes('execute') || trimmed.includes('createQuery'))) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-6`,
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

    // Rule 7: Unclosed resources (InputStream / OutputStream / Connection) without try-with-resources
    if (/\b(FileInputStream|FileOutputStream|BufferedReader|Connection|Statement)\s+[a-zA-Z0-9_]+\s*=\s*/.test(trimmed) && !trimmed.startsWith('try') && !code.includes('try (')) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-7`,
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

    // Rule 8: Raw generic types (e.g. List list = new ArrayList())
    if (/\b(List|Map|Set|HashMap|ArrayList)\s+[a-zA-Z0-9_]+\s*=\s*new\s+\1/.test(trimmed)) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-8`,
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

    // Rule 9: Thread.sleep in production or non-test code
    if (/Thread\.sleep\(/.test(trimmed) && !filePath.includes('test')) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-9`,
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

    // Rule 10: @Transactional on non-public method
    if (/@Transactional/.test(trimmed) && (lines[idx + 1]?.includes('private ') || lines[idx + 1]?.includes('protected '))) {
      issues.push({
        id: `sonar-${filePath}-${lineNum}-10`,
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
  });

  return issues;
};

export const SonarToolWindow: React.FC<SonarToolWindowProps> = ({
  activeTab,
  currentProjectDirectory,
  onOpenFileAtLocation,
  onExecuteMavenGoal,
  onShowToast,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [issues, setIssues] = useState<SonarIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<SonarIssue | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUG' | 'VULNERABILITY' | 'CODE_SMELL' | 'SECURITY_HOTSPOT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabMode, setActiveTabMode] = useState<'currentFile' | 'projectReport' | 'serverMode'>('currentFile');

  // Telemetry status
  const [telemetryMessage, setTelemetryMessage] = useState<string>('');

  // Server Connected Mode config
  const [sonarConfig, setSonarConfig] = useState<SonarServerConfig>(() => getSavedSonarConfig());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [serverChecking, setServerChecking] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [serverVersion, setServerVersion] = useState<string>('');

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

  // Phase 1: Local Single File Analysis
  const handleAnalyzeActiveFile = () => {
    if (!activeTab || !activeTab.content) {
      onShowToast?.('SonarLint', 'No active file open in editor to analyze.', 'info');
      return;
    }

    setAnalyzing(true);
    setTelemetryMessage(`Analyzing ${activeTab.title}...`);
    const startTime = performance.now();

    setTimeout(() => {
      const detected = analyzeCodeForSonarIssues(activeTab.content || '', activeTab.path || activeTab.title);
      const elapsed = Math.round(performance.now() - startTime);
      setIssues(detected);
      setSelectedIssue(detected[0] || null);
      setAnalyzing(false);
      const loc = (activeTab.content || '').split('\n').length;
      setTelemetryMessage(`Analyzed ${activeTab.title} (${loc} LOC, 10 Clean Code rules) in ${elapsed}ms: ${detected.length} issue(s)`);
      onShowToast?.(
        'SonarLint Analysis Finished',
        `Analyzed ${activeTab.title}: found ${detected.length} issue(s)`,
        detected.length > 0 ? 'warning' : 'success'
      );
    }, 200);
  };

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
      setActiveTabMode('projectReport');
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
      setActiveTabMode('serverMode');
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

  // Auto-analyze active file on open/tab change if in currentFile mode
  useEffect(() => {
    if (activeTabMode === 'currentFile' && activeTab?.content) {
      const detected = analyzeCodeForSonarIssues(activeTab.content, activeTab.path || activeTab.title);
      setIssues(detected);
      setSelectedIssue(detected[0] || null);
      setTelemetryMessage(`Analyzed ${activeTab.title} (${activeTab.content.split('\n').length} LOC): ${detected.length} issues`);
    }
  }, [activeTab?.path, activeTab?.content, activeTabMode]);

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
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
  }, [issues, severityFilter, typeFilter, searchQuery]);

  // Group issues by file name
  const issuesByFile = useMemo(() => {
    const map = new Map<string, SonarIssue[]>();
    for (const issue of filteredIssues) {
      const list = map.get(issue.fileName) || [];
      list.push(issue);
      map.set(issue.fileName, list);
    }
    return map;
  }, [filteredIssues]);

  const counts = useMemo(() => {
    return {
      bugs: issues.filter(i => i.type === 'BUG').length,
      vulnerabilities: issues.filter(i => i.type === 'VULNERABILITY').length,
      codeSmells: issues.filter(i => i.type === 'CODE_SMELL').length,
      hotspots: issues.filter(i => i.type === 'SECURITY_HOTSPOT').length,
      blockers: issues.filter(i => i.severity === 'BLOCKER').length,
    };
  }, [issues]);

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
      {/* Top Action Bar */}
      <div className="h-9 border-b border-[#2B2D30] px-3 flex items-center justify-between bg-[#1E1F22] flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Sonar Brand Icon */}
          <div className="flex items-center gap-1.5 font-semibold text-white">
            <SonarIcon size={16} />
            <span>SonarLint / SonarQube</span>
            <span className="text-[10px] text-[#4B9FD5] bg-[#4B9FD5]/10 px-1.5 py-0.5 rounded border border-[#4B9FD5]/20 font-mono">
              v10.4
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[#2B2D30] mx-1" />

          {/* Mode Switchers */}
          <div className="flex items-center gap-1 bg-[#18191B] p-0.5 rounded border border-[#2B2D30]">
            <button
              onClick={() => {
                setActiveTabMode('currentFile');
                if (activeTab?.content) {
                  const detected = analyzeCodeForSonarIssues(activeTab.content, activeTab.path || activeTab.title);
                  setIssues(detected);
                  setSelectedIssue(detected[0] || null);
                }
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeTabMode === 'currentFile' ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-white'
              }`}
            >
              Current File ({activeTab?.title || 'None'})
            </button>

            <button
              onClick={() => {
                setActiveTabMode('projectReport');
                if (issues.length === 0) {
                  handleScanProjectFiles();
                }
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeTabMode === 'projectReport' ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-white'
              }`}
            >
              Project Quality Gate
            </button>

            <button
              onClick={() => {
                setActiveTabMode('serverMode');
                handleFetchFromServer();
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                activeTabMode === 'serverMode' ? 'bg-[#3574F0] text-white' : 'text-[#868A91] hover:text-white'
              }`}
            >
              <Globe size={11} />
              <span>Server Mode</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTabMode === 'currentFile' && (
            <button
              onClick={handleAnalyzeActiveFile}
              disabled={analyzing}
              className="px-2.5 py-1 bg-[#2B2D30] hover:bg-[#35373B] text-[#DFE1E5] rounded flex items-center gap-1.5 border border-[#393B40] transition-colors cursor-pointer"
              title="Analyze active file with Sonar rules"
            >
              <RotateCw size={12} className={analyzing ? 'animate-spin text-[#3574F0]' : 'text-[#59A869]'} />
              <span>Analyze File</span>
            </button>
          )}

          {activeTabMode === 'projectReport' && (
            <button
              onClick={handleScanProjectFiles}
              disabled={analyzing}
              className="px-2.5 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
              title="Scan all Java files in project"
            >
              <RotateCw size={12} className={analyzing ? 'animate-spin' : ''} />
              <span>Scan Project Files</span>
            </button>
          )}

          {activeTabMode === 'serverMode' && (
            <button
              onClick={handleFetchFromServer}
              disabled={analyzing}
              className="px-2.5 py-1 bg-[#4B9FD5] hover:bg-[#4090C5] text-white rounded flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
              title="Sync Quality Gate & Issues from SonarQube Server"
            >
              <RefreshCw size={12} className={analyzing ? 'animate-spin' : ''} />
              <span>Fetch from Server</span>
            </button>
          )}

          {/* Configure SonarQube Server */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-1.5 text-[#868A91] hover:text-[#DFE1E5] hover:bg-[#2B2D30] rounded border border-[#393B40] transition-colors"
            title="Configure SonarQube Server URL & Token"
          >
            <SettingsIcon size={13} />
          </button>

          {/* Execute Maven Sonar Goal */}
          {onExecuteMavenGoal && (
            <button
              onClick={() => onExecuteMavenGoal(buildMavenSonarCommand(sonarConfig))}
              className="px-2.5 py-1 bg-[#4B9FD5]/20 hover:bg-[#4B9FD5]/30 text-[#85B1F8] rounded flex items-center gap-1.5 border border-[#4B9FD5]/40 transition-colors cursor-pointer font-medium"
              title={`Run '${buildMavenSonarCommand(sonarConfig)}' in Terminal`}
            >
              <Terminal size={12} />
              <span>mvn sonar:sonar</span>
            </button>
          )}
        </div>
      </div>

      {/* Telemetry & Server Indicator Bar */}
      <div className="h-6 bg-[#18191B] border-b border-[#2B2D30] px-3 flex items-center justify-between text-[11px] text-[#868A91]">
        <div className="flex items-center gap-2 truncate">
          {telemetryMessage ? (
            <span className="text-[#C4C7C5] font-mono truncate">{telemetryMessage}</span>
          ) : (
            <span>Sonar engine active • Ready for inspection</span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div 
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 cursor-pointer hover:underline text-[#868A91] hover:text-[#DFE1E5]"
          >
            <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-[#59A869]' : serverOnline === false ? 'bg-[#E05555]' : 'bg-[#EDA200]'}`} />
            <span>{sonarConfig.serverUrl}</span>
            <span className="text-[#3574F0] font-mono">({sonarConfig.projectKey})</span>
          </div>
        </div>
      </div>

      {/* Filter Ribbon & Metrics Bar */}
      <div className="h-7 border-b border-[#2B2D30] px-3 bg-[#26282B] flex items-center justify-between text-[11px] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[#868A91]">
            <span>Filter:</span>
          </div>

          {/* Type filters */}
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-1.5 py-0.5 rounded text-[10.5px] ${typeFilter === 'ALL' ? 'bg-[#3574F0]/20 text-[#85B1F8] font-bold' : 'text-[#868A91] hover:text-white'}`}
          >
            All ({issues.length})
          </button>
          <button
            onClick={() => setTypeFilter('BUG')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] ${typeFilter === 'BUG' ? 'bg-[#E05555]/20 text-[#E05555] font-bold' : 'text-[#868A91] hover:text-[#E05555]'}`}
          >
            <Bug size={11} />
            <span>Bugs ({counts.bugs})</span>
          </button>
          <button
            onClick={() => setTypeFilter('VULNERABILITY')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] ${typeFilter === 'VULNERABILITY' ? 'bg-[#FF8800]/20 text-[#FF8800] font-bold' : 'text-[#868A91] hover:text-[#FF8800]'}`}
          >
            <ShieldAlert size={11} />
            <span>Vulnerabilities ({counts.vulnerabilities})</span>
          </button>
          <button
            onClick={() => setTypeFilter('CODE_SMELL')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] ${typeFilter === 'CODE_SMELL' ? 'bg-[#3574F0]/20 text-[#85B1F8] font-bold' : 'text-[#868A91] hover:text-[#85B1F8]'}`}
          >
            <Zap size={11} />
            <span>Code Smells ({counts.codeSmells})</span>
          </button>
          <button
            onClick={() => setTypeFilter('SECURITY_HOTSPOT')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] ${typeFilter === 'SECURITY_HOTSPOT' ? 'bg-[#EDA200]/20 text-[#EDA200] font-bold' : 'text-[#868A91] hover:text-[#EDA200]'}`}
          >
            <Flame size={11} />
            <span>Hotspots ({counts.hotspots})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-1 bg-[#1E1F22] border border-[#393B40] px-2 py-0.5 rounded w-48">
          <Search size={11} className="text-[#868A91]" />
          <input
            type="text"
            placeholder="Search rules, messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-[11px] text-[#DFE1E5] outline-none w-full placeholder:text-[#868A91]"
          />
        </div>
      </div>

      {/* Main Content Area: Split View (Left: Issue Tree, Right: Sonar Rule Explanation) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Pane: List of Issues (Grouped by file when in project mode) */}
        <div className="w-[55%] border-r border-[#2B2D30] flex flex-col overflow-y-auto">
          {filteredIssues.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#868A91]">
              <CheckCircle2 size={32} className="text-[#59A869] mb-2" />
              <div className="text-white font-medium text-xs">Quality Gate Passed!</div>
              <div className="text-[11px] text-[#868A91] mt-1 max-w-sm">
                {activeTabMode === 'currentFile' 
                  ? `No SonarLint issues found in ${activeTab?.title || 'active file'}. Code adheres to clean architecture standards.`
                  : activeTabMode === 'projectReport'
                  ? 'No Clean Code issues found across analyzed project files.'
                  : `All remote SonarQube checks passed for ${sonarConfig.projectKey}.`
                }
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#2B2D30]">
              {Array.from(issuesByFile.entries()).map(([fileName, fileIssues]) => (
                <div key={fileName} className="bg-[#1E1F22]">
                  {/* File Header */}
                  {activeTabMode !== 'currentFile' && (
                    <div className="px-3 py-1.5 bg-[#25272B] text-[11px] font-semibold text-[#DFE1E5] flex items-center justify-between border-b border-[#2B2D30]">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileCode size={13} className="text-[#4B9FD5] shrink-0" />
                        <span className="truncate">{fileName}</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#3574F0]/20 text-[#85B1F8]">
                        {fileIssues.length}
                      </span>
                    </div>
                  )}

                  {/* Issues list for this file */}
                  <div className="divide-y divide-[#2B2D30]/60">
                    {fileIssues.map((issue) => {
                      const isSelected = selectedIssue?.id === issue.id;
                      return (
                        <div
                          key={issue.id}
                          onClick={() => {
                            setSelectedIssue(issue);
                            onOpenFileAtLocation(issue.filePath, issue.line, issue.column);
                          }}
                          className={`p-2.5 flex items-start gap-2.5 cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#2E436E]/70 border-l-2 border-[#3574F0]' : 'hover:bg-[#2B2D30]/60'
                          }`}
                        >
                          {/* Severity / Type Icon */}
                          <div className="mt-0.5">{getTypeIcon(issue.type)}</div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-medium text-white truncate flex items-center gap-1.5">
                                <span>{issue.message}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {getSeverityBadge(issue.severity)}
                                <span className="text-[10px] text-[#868A91] font-mono">{issue.effort}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 mt-1 text-[10.5px] text-[#868A91]">
                              <span className="font-mono text-[#85B1F8]">{issue.ruleKey}</span>
                              <span>•</span>
                              <span className="hover:underline flex items-center gap-1">
                                <FileCode size={10} />
                                {issue.fileName}:{issue.line}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Pane: Sonar Rule Guide & Remediation Code */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-[#1E1F22] p-4 text-xs">
          {selectedIssue ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="border-b border-[#2B2D30] pb-3">
                <div className="flex items-center gap-2 mb-1">
                  {getTypeIcon(selectedIssue.type)}
                  <span className="font-mono text-xs font-bold text-[#85B1F8]">{selectedIssue.ruleKey}</span>
                  {getSeverityBadge(selectedIssue.severity)}
                  <span className="text-[10.5px] text-[#868A91] px-1.5 py-0.2 rounded bg-[#2B2D30] border border-[#393B40]">
                    {selectedIssue.type.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">{selectedIssue.ruleName}</h3>
                <div className="text-[11px] text-[#868A91] mt-1">
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

              {/* Noncompliant Code */}
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

              {/* Quick Jump */}
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
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#868A91]">
              <SonarIcon size={32} className="opacity-40 mb-2" />
              <div className="font-medium text-xs text-white">No issue selected</div>
              <div className="text-[11px] text-[#868A91] mt-1">
                Select an issue on the left to inspect its rule explanation and clean code solution.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SonarQube Server Configuration Modal */}
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
