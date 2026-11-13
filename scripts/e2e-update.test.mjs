import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createMockUpdateServer } from './mock-update-server.mjs';

async function loadRealUpdaterService(tempDir) {
  const outfile = path.join(tempDir, 'updaterService.bundle.mjs');
  await build({
    entryPoints: [path.resolve('src/services/updaterService.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    plugins: [
      {
        name: 'mock-tauri-core',
        setup(b) {
          b.onResolve({ filter: /^@tauri-apps\/api\/core$/ }, () => ({
            path: 'tauri-core-stub',
            namespace: 'stub',
          }));
          b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
            contents:
              'export async function invoke(cmd, args) { (globalThis.__MOCK_TAURI_INVOKES__ ??= []).push({ cmd, args }); return null; }',
            loader: 'js',
          }));
        },
      },
    ],
  });
  return await import(pathToFileURL(outfile).href);
}

test('E2E Auto-Update flow exercises real updaterService.ts against mock-update-server.mjs', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-idea-e2e-'));
  const existingPortable = path.resolve('dist-portable/Custom-IDEA-Portable.exe');
  let exePath = existingPortable;

  if (!fs.existsSync(exePath)) {
    exePath = path.join(tempDir, 'Dummy-Custom-IDEA.exe');
    fs.writeFileSync(exePath, Buffer.alloc(1024 * 600, 0x5a));
  }

  const updater = await loadRealUpdaterService(tempDir);
  let forceFlag = false;
  let badShaFlag = false;
  let versionOverride = '0.2.0';
  let failServer = false;

  // Wrap createMockUpdateServer with dynamic query params via URL path routing or separate requests
  const baseServer = createMockUpdateServer({ exePath, quiet: true });
  const server = (await import('http')).default.createServer((req, res) => {
    if (req.url === '/version.json' || req.url?.startsWith('/version.json?')) {
      const q = new URLSearchParams();
      if (forceFlag) q.set('force', 'true');
      if (badShaFlag) q.set('badsha', 'true');
      if (failServer) q.set('fail', '500');
      q.set('version', versionOverride);
      req.url = `/version.json?${q.toString()}`;
    }
    baseServer.emit('request', req, res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Up-to-date scenario: checkUpdate returns null when remote version == current version
    versionOverride = '0.1.2';
    const upToDate = await updater.checkUpdate('0.1.2', baseUrl);
    assert.equal(upToDate, null);

    // 2. Server HTTP 500 error: checkUpdate throws instead of reporting false up-to-date
    failServer = true;
    await assert.rejects(() => updater.checkUpdate('0.1.2', baseUrl), /HTTP 500/);
    failServer = false;

    // 3. Normal update + streaming progress + SHA-256 verification
    versionOverride = '0.2.0';
    const meta = await updater.checkUpdate('0.1.2', baseUrl);
    assert.ok(meta);
    assert.equal(meta.version, '0.2.0');
    assert.equal(meta.forceUpdate, false);

    let lastPercent = 0;
    const buf = await updater.downloadUpdateWithProgress(
      meta.downloadUrl,
      meta.size,
      (p) => { lastPercent = p.percent; }
    );
    assert.equal(buf.byteLength, meta.size);
    assert.equal(lastPercent, 100);
    assert.equal(await updater.verifySha256(buf, meta.sha256), true);

    globalThis.__MOCK_TAURI_INVOKES__ = [];
    await updater.applyUpdateAndRestart(buf, meta.sha256);
    assert.equal(globalThis.__MOCK_TAURI_INVOKES__.length, 1);
    assert.equal(globalThis.__MOCK_TAURI_INVOKES__[0].cmd, 'apply_update_and_restart');
    assert.equal(globalThis.__MOCK_TAURI_INVOKES__[0].args.expectedSha256, meta.sha256);
    assert.equal(globalThis.__MOCK_TAURI_INVOKES__[0].args.newExeBytes.length, meta.size);

    await assert.rejects(
      () => updater.applyUpdateAndRestart(buf, '   '),
      /Missing expected SHA-256/
    );

    // 4. Force update metadata flag
    forceFlag = true;
    const forceMeta = await updater.checkUpdate('0.1.2', baseUrl);
    assert.equal(forceMeta.forceUpdate, true);
    forceFlag = false;

    // 5. Tampered SHA-256 rejection
    badShaFlag = true;
    const badMeta = await updater.checkUpdate('0.1.2', baseUrl);
    assert.equal(await updater.verifySha256(buf, badMeta.sha256), false);
    badShaFlag = false;

    // 6. AbortSignal cancellation aborts in-flight download
    const abortCtrl = new AbortController();
    abortCtrl.abort();
    await assert.rejects(
      () => updater.downloadUpdateWithProgress(meta.downloadUrl, meta.size, () => {}, abortCtrl.signal),
      (err) => err?.name === 'AbortError'
    );
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
