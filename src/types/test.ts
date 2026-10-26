export type TestCaseStatus = 'passed' | 'failed' | 'running' | 'ignored' | 'queued';

export interface TestCaseItem {
  id: string;
  name: string;
  suite: string;
  status: TestCaseStatus;
  durationMs: number;
  filePath: string;
  lineNumber: number;
  errorDetails?: string;
  expected?: string;
  actual?: string;
  stackTrace?: string;
  output?: string;
}

export interface TestSuiteItem {
  id: string;
  name: string;
  status: TestCaseStatus;
  durationMs: number;
  filePath?: string;
  tests: TestCaseItem[];
}

export interface TestRunSession {
  id: string;
  configName: string;
  toolchainType: 'cargo' | 'npm' | 'pytest' | 'maven' | 'gradle' | 'custom';
  startedAt: string;
  durationMs: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  ignoredTests: number;
  suites: TestSuiteItem[];
  rawOutput: string;
  isRunning: boolean;
}

export interface ProjectToolchainInfo {
  type: 'rust' | 'node' | 'java' | 'python' | 'docker';
  name: string;
  version?: string;
  path?: string;
  detected: boolean;
  buildFiles: string[];
  statusMessage?: string;
}

export const SAMPLE_TEST_SESSION: TestRunSession = {
  id: 'session-demo',
  configName: 'cargo test (Full Project Suite)',
  toolchainType: 'cargo',
  startedAt: new Date().toLocaleTimeString(),
  durationMs: 428,
  totalTests: 16,
  passedTests: 14,
  failedTests: 1,
  ignoredTests: 1,
  isRunning: false,
  rawOutput: `running 16 tests
test database::tests::test_sqlite_connection ... ok
test database::tests::test_query_execution ... ok
test database::tests::test_schema_inspection ... ok
test git::tests::test_git_status_parse ... ok
test git::tests::test_branch_list ... ok
test git::tests::test_diff_unified_format ... ok
test git::tests::test_stash_roundtrip ... ok
test terminal::tests::test_pty_spawn_powershell ... ok
test terminal::tests::test_ansi_color_parsing ... ok
test editor::tests::test_surround_with_template ... ok
test editor::tests::test_optimize_imports ... ok
test editor::tests::test_bracket_matcher ... ok
test ai::tests::test_ghost_text_inference ... ok
test themes::tests::test_theme_token_sync ... ok
test auth::tests::test_token_refresh_expiration ... FAILED
test cloud::tests::test_remote_sync ... ignored

failures:

---- auth::tests::test_token_refresh_expiration stdout ----
thread 'auth::tests::test_token_refresh_expiration' panicked at src/auth/token.rs:88:9:
assertion 'left == right' failed
  left: 401
 right: 200
note: run with RUST_BACKTRACE=1 environment variable to display a backtrace

test result: FAILED. 14 passed; 1 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.43s`,
  suites: [
    {
      id: 'suite-database',
      name: 'database::tests',
      status: 'passed',
      durationMs: 64,
      filePath: 'src-tauri/src/lib.rs',
      tests: [
        {
          id: 'test-db-1',
          name: 'test_sqlite_connection',
          suite: 'database::tests',
          status: 'passed',
          durationMs: 24,
          filePath: 'src-tauri/src/lib.rs',
          lineNumber: 120,
          output: 'SQLite driver verified and memory DB initialized.'
        },
        {
          id: 'test-db-2',
          name: 'test_query_execution',
          suite: 'database::tests',
          status: 'passed',
          durationMs: 18,
          filePath: 'src-tauri/src/lib.rs',
          lineNumber: 145,
          output: 'SELECT 1 executed successfully in 1.2ms.'
        },
        {
          id: 'test-db-3',
          name: 'test_schema_inspection',
          suite: 'database::tests',
          status: 'passed',
          durationMs: 22,
          filePath: 'src-tauri/src/lib.rs',
          lineNumber: 168
        }
      ]
    },
    {
      id: 'suite-git',
      name: 'git::tests',
      status: 'passed',
      durationMs: 112,
      filePath: 'src-tauri/src/lib.rs',
      tests: [
        {
          id: 'test-git-1',
          name: 'test_git_status_parse',
          suite: 'git::tests',
          status: 'passed',
          durationMs: 32,
          filePath: 'src-tauri/src/lib.rs',
          lineNumber: 820
        },
        {
          id: 'test-git-2',
          name: 'test_branch_list',
          suite: 'git::tests',
          status: 'passed',
          durationMs: 25,
          filePath: 'src-tauri/src/lib.rs',
          lineNumber: 974
        },
        {
          id: 'test-git-3',
          name: 'test_diff_unified_format',
          suite: 'git::tests',
          status: 'passed',
          durationMs: 30,
          filePath: 'src-tauri/src/lib.rs',
          lineNumber: 849
        },
        {
          id: 'test-git-4',
          name: 'test_stash_roundtrip',
          suite: 'git::tests',
          status: 'passed',
          durationMs: 25,
          filePath: 'src-tauri/src/lib.rs',
          lineNumber: 1062
        }
      ]
    },
    {
      id: 'suite-editor',
      name: 'editor::tests',
      status: 'passed',
      durationMs: 98,
      filePath: 'src/components/CodeEditor.tsx',
      tests: [
        {
          id: 'test-ed-1',
          name: 'test_surround_with_template',
          suite: 'editor::tests',
          status: 'passed',
          durationMs: 28,
          filePath: 'src/components/CodeEditor.tsx',
          lineNumber: 48
        },
        {
          id: 'test-ed-2',
          name: 'test_optimize_imports',
          suite: 'editor::tests',
          status: 'passed',
          durationMs: 34,
          filePath: 'src/components/CodeEditor.tsx',
          lineNumber: 60
        },
        {
          id: 'test-ed-3',
          name: 'test_bracket_matcher',
          suite: 'editor::tests',
          status: 'passed',
          durationMs: 36,
          filePath: 'src/components/CodeEditor.tsx',
          lineNumber: 120
        }
      ]
    },
    {
      id: 'suite-auth',
      name: 'auth::tests',
      status: 'failed',
      durationMs: 142,
      filePath: 'src-tauri/src/lib.rs',
      tests: [
        {
          id: 'test-auth-1',
          name: 'test_token_refresh_expiration',
          suite: 'auth::tests',
          status: 'failed',
          durationMs: 142,
          filePath: 'src-tauri/src/lib.rs',
          lineNumber: 88,
          errorDetails: "assertion 'left == right' failed: HTTP status code mismatch",
          expected: '200 OK',
          actual: '401 Unauthorized (Token expired at 1714201020)',
          stackTrace: `thread 'auth::tests::test_token_refresh_expiration' panicked at src-tauri/src/lib.rs:88:9:
assertion 'left == right' failed
  left: 401
 right: 200
stack backtrace:
   0: rust_begin_unwind
   1: core::panicking::panic_fmt
   2: auth::tests::test_token_refresh_expiration at src-tauri/src/lib.rs:88:9
   3: core::ops::function::FnOnce::call_once
   4: test::run_test::run_test_inner::{{closure}}
   5: std::sys_common::backtrace::__rust_begin_short_backtrace`,
          output: 'Testing token expiration with simulated clock offset of +3600s...'
        }
      ]
    },
    {
      id: 'suite-cloud',
      name: 'cloud::tests',
      status: 'ignored',
      durationMs: 0,
      filePath: 'src-tauri/src/lib.rs',
      tests: [
        {
          id: 'test-cloud-1',
          name: 'test_remote_sync',
          suite: 'cloud::tests',
          status: 'ignored',
          durationMs: 0,
          filePath: 'src-tauri/src/lib.rs',
          lineNumber: 300,
          output: 'Test ignored: requires AWS/GCP remote cloud credentials.'
        }
      ]
    }
  ]
};
