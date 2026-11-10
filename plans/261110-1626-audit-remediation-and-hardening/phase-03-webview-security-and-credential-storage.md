---
phase: 3
title: "WebView Security and Credential Storage"
status: pending
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 3: WebView Security and Credential Storage

## Overview
Eliminate arbitrary JavaScript evaluation (`new Function`) in the debugger evaluator, enable a strict Content-Security-Policy (CSP) in Tauri config, and migrate SonarQube, Local AI, and GitHub tokens out of plaintext `localStorage` into OS Credential Manager (`keyring`), enforcing HTTPS and environment-variable secret passing for SonarQube scans. (Covers audit findings #2 and #12.)

## Requirements
- **Functional:**
  - `EvaluateExpressionModal.tsx` relies on real DAP `dapService.evaluate(expr)` when debugging and uses a safe zero-eval lookup helper (property paths / simple literals, NO `new Function` or `eval`) when idle/offline.
  - `tauri.conf.json` sets an explicit CSP permitting only bundled scripts/styles/fonts and localhost dev/API connections as required by Tauri v2.
  - SonarQube tokens (`sonarService.ts`), Local AI `apiKey` (`localAiService.ts`), and GitHub tokens (`VersionControlPanel.tsx` / `ToolsPanel.tsx`) are stored via Rust OS `keyring` Tauri commands, never persisted in `localStorage`.
  - SonarQube rejects `http://` URLs when sending `Basic` auth credentials unless explicitly local loopback (`http://localhost` / `http://127.0.0.1`), and passes Maven Sonar token via process environment (`SONAR_TOKEN`) instead of `-Dsonar.login=...` CLI strings or React HTML `title` tooltips (`SonarToolWindow.tsx`).
- **Non-functional:**
  - Reuse `keyring` already configured in root `Cargo.toml` (`"3.6"`) cleanly via generic service-scoped commands.

## Architecture
- **Shared Keyring Secret Commands (`src-tauri/src/` or `crates/ide-vcs`):** Small module `secrets.rs` exposing `secret_set(namespace, key, value)`, `secret_get(namespace, key)`, `secret_delete(namespace, key)` backed by `keyring::Entry::new("custom-idea", format!("{}:{}", namespace, key))` (mirroring existing GitLab keyring reliability). Legacy tokens found in `localStorage` on first read are migrated once into `keyring` and wiped from `localStorage`.
- **Safe Non-DAP Expression Fallback:** Simple dot/bracket property path resolver on `contextObj` (e.g., `user.name`, `items.length`, string/number/boolean literals) — ~25 lines, zero `Function` or `eval`.
- **Maven Sonar Token Isolation:** `SonarToolWindow.tsx` runs Maven goal `mvn.cmd sonar:sonar -Dsonar.host.url=... -Dsonar.projectKey=...` (display-safe, no token in UI `title` or CLI args), passing `SONAR_TOKEN` through `env_vars` to `execute_build_command` (or reading from keyring on Rust side if preferred).

## Related Code Files
- Modify: `D:\IDE\src-tauri\tauri.conf.json`
- Modify: `D:\IDE\src-tauri\Cargo.toml` (add `keyring = { workspace = true }` if commands live in `src-tauri`)
- Create: `D:\IDE\src-tauri\src\secrets.rs` (or expose from existing crate)
- Modify: `D:\IDE\src-tauri\src\commands.rs`
- Modify: `D:\IDE\src\features\debugger\EvaluateExpressionModal.tsx`
- Modify: `D:\IDE\src\features\sonar\sonarService.ts`
- Modify: `D:\IDE\src\features\sonar\SonarToolWindow.tsx`
- Modify: `D:\IDE\src\features\ai\localAiService.ts`
- Modify: `D:\IDE\src\features\settings\panels\VersionControlPanel.tsx`
- Modify: `D:\IDE\src\features\settings\panels\ToolsPanel.tsx`

## Implementation Steps
1. **CSP & Debugger Evaluator (`src-tauri/tauri.conf.json`, `EvaluateExpressionModal.tsx`):**
   - Replace `"csp": null` in `src-tauri/tauri.conf.json:30` with a strict CSP (e.g., `"default-src 'self' ipc: http://ipc.localhost; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset: http://asset.localhost; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost ws://localhost:* http://localhost:* https:"`). Verify production bundle & Tauri IPC work with CSP enabled.
   - Replace `new Function(...scopeKeys, \`return (${expr});\`)` (`EvaluateExpressionModal.tsx:99`) with a safe property-path/JSON/comparison evaluator on `contextObj` (no arbitrary JS code execution).
2. **OS Keyring Commands (`src-tauri/src/secrets.rs` & `commands.rs`):**
   - Implement `app_secret_set`, `app_secret_get`, `app_secret_delete` using `keyring::Entry`, validating non-empty namespace (`sonar`, `local_ai`, `github`) and key.
   - Register in `src-tauri/src/commands.rs`.
3. **Migrate Frontend Secrets (`sonarService.ts`, `SonarToolWindow.tsx`, `localAiService.ts`, `VersionControlPanel.tsx`, `ToolsPanel.tsx`):**
   - **Sonar:** Strip `token` before writing `intellij_sonarqube_config` / `intellij_sonarqube_connections` to `localStorage`; store/read `token` in `app_secret_*` (`namespace: "sonar"`), auto-migrating any legacy `localStorage` token and scrubbing it on load. Require `https://` when `token` is non-empty (allow `http://localhost` / `http://127.0.0.1` for local Sonar containers). Update `buildMavenSonarCommand` (`sonarService.ts:262-268`) and `SonarToolWindow.tsx:1143-1146` to pass `SONAR_TOKEN` via `env_vars` (never inside command string or `title` attribute).
   - **Local AI:** Strip `apiKey` from `local_ai_config` in `localAiService.ts:34-48`; persist/retrieve via `app_secret_*` (`namespace: "local_ai"`).
   - **GitHub:** Replace `intellij_github_user` plaintext `localStorage` token storage in `VersionControlPanel.tsx:284-288` with keyring storage (keeping only display username/status in `localStorage`), and wire `ToolsPanel.tsx` to read stored GitHub token seamlessly if `taskToken` input is blank.

## Todo List
- [ ] Configure strict WebView CSP in `src-tauri/tauri.conf.json`
- [ ] Replace `new Function` in `EvaluateExpressionModal.tsx` with safe property-path/literal inspector
- [ ] Add `app_secret_set`/`get`/`delete` keyring commands in `src-tauri`
- [ ] Migrate SonarQube, Local AI, and GitHub secrets from `localStorage` to OS keyring with one-time legacy scrub
- [ ] Enforce HTTPS for remote Sonar auth and pass Sonar token via `SONAR_TOKEN` env var instead of CLI/HTML tooltip

## Success Criteria
- [ ] Zero `new Function`, `eval`, or `"csp": null` remaining in the codebase.
- [ ] `localStorage` keys (`intellij_sonarqube_*`, `local_ai_config`, `intellij_github_user`) contain zero secret tokens/API keys after save/migration.
- [ ] Hovering `mvn sonar:sonar` button in `SonarToolWindow` never displays the Sonar token in tooltip text.

## Risk Assessment
- Overly restrictive CSP could break CodeMirror inline styles or Tailwind utility rendering or Vite dev server HMR — mitigate by keeping `'unsafe-inline'` ONLY on `style-src` (required by CodeMirror/xterm inline style attributes) while banning `'unsafe-eval'` and arbitrary remote `script-src`, then verifying `pnpm build` + desktop launch.
- Existing users upgrading lose cached tokens unless legacy `localStorage` tokens are migrated once on load and scrubbed — handled explicitly in step 3.

## Security Considerations
- Protects WebView against XSS privilege escalation to Tauri IPC (`csp` + no `new Function`) and prevents credential harvesting from unencrypted `localStorage` SQLite/LevelDB files or process command lines.
