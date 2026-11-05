import { Extension } from '@codemirror/state';
import { linter, Diagnostic } from '@codemirror/lint';
import { analyzeCodeForSonarIssues } from '../../features/sonar/SonarToolWindow';

export function createSonarLinterExtension(filePath: string): Extension {
  return linter((view) => {
    const doc = view.state.doc;
    const text = doc.toString();
    const issues = analyzeCodeForSonarIssues(text, filePath);

    const diagnostics: Diagnostic[] = [];

    for (const issue of issues) {
      if (issue.line > doc.lines) continue;
      const line = doc.line(issue.line);
      const from = Math.min(line.to, line.from + Math.max(0, issue.column - 1));
      const to = Math.min(line.to, from + 10);

      let severity: 'error' | 'warning' | 'info' = 'warning';
      if (issue.severity === 'BLOCKER' || issue.severity === 'CRITICAL') {
        severity = 'error';
      } else if (issue.severity === 'INFO') {
        severity = 'info';
      }

      diagnostics.push({
        from: Math.max(line.from, from),
        to: Math.max(from + 1, to),
        severity,
        source: `SonarLint (${issue.ruleKey})`,
        message: `[${issue.type}] ${issue.message}\nRule: ${issue.ruleName}`,
      });
    }

    return diagnostics;
  }, { delay: 400 });
}
