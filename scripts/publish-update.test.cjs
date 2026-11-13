const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  getGitLabPackages,
  deletePackage,
  purgeOldReleases,
  buildDownloadUrl,
  buildVersionMetadata,
} = require('./publish-update.cjs');

function createMockHttpClient(handler) {
  return {
    request(options, callback) {
      const req = new EventEmitter();
      req.end = () => {
        const spec = handler(options);
        if (spec.error) {
          queueMicrotask(() => req.emit('error', spec.error));
          return;
        }
        const res = new EventEmitter();
        res.statusCode = spec.statusCode;
        queueMicrotask(() => {
          callback(res);
          if (spec.body !== undefined) {
            res.emit('data', spec.body);
          }
          res.emit('end');
        });
      };
      return req;
    },
  };
}

const dummyConfig = {
  host: 'gitlab.example.com',
  projectId: '299',
  token: 'test-token',
  packageName: 'custom-idea',
  allowSelfSignedTls: false,
};

test('deletePackage returns ok: true on 204 No Content and enables TLS verification by default', async () => {
  let capturedOptions = null;
  const mockHttp = createMockHttpClient((opts) => {
    capturedOptions = opts;
    return { statusCode: 204, body: '' };
  });

  const res = await deletePackage(dummyConfig, 17, 'latest', mockHttp);
  assert.equal(res.ok, true);
  assert.equal(res.statusCode, 204);
  assert.equal(capturedOptions.rejectUnauthorized, true);
});

test('deletePackage returns ok: false with statusCode 403 on Forbidden', async () => {
  const mockHttp = createMockHttpClient(() => ({
    statusCode: 403,
    body: '{"message":"403 Forbidden"}',
  }));

  const res = await deletePackage(dummyConfig, 17, 'latest', mockHttp);
  assert.equal(res.ok, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.message, /403 Forbidden/);
});

test('getGitLabPackages surfaces 401/500 errors instead of returning empty array', async () => {
  const mockHttp = createMockHttpClient(() => ({
    statusCode: 401,
    body: '{"message":"401 Unauthorized"}',
  }));

  const res = await getGitLabPackages(dummyConfig, mockHttp);
  assert.equal(res.ok, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.packages, []);
});

test('purgeOldReleases fails and does not log [OK] when delete returns 403', async () => {
  const logs = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => logs.push(args.join(' '));

  try {
    const mockHttp = createMockHttpClient((opts) => {
      if (opts.method === 'GET') {
        return {
          statusCode: 200,
          body: JSON.stringify([{ id: 17, name: 'custom-idea', version: 'latest' }]),
        };
      }
      if (opts.method === 'DELETE') {
        return {
          statusCode: 403,
          body: '{"message":"403 Forbidden"}',
        };
      }
      throw new Error(`Unexpected method ${opts.method}`);
    });

    const result = await purgeOldReleases(dummyConfig, mockHttp);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'delete_failed');
    assert.equal(logs.some((line) => line.includes('[OK]')), false);
    assert.equal(logs.some((line) => line.includes('403') && line.includes('Maintainer')), true);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
});

test('buildVersionMetadata URL-encodes path segments in downloadUrl and emits sha256', () => {
  const specialConfig = {
    host: 'gitlab.example.com',
    projectId: 'group/sub project',
    packageName: 'custom idea@win',
  };
  const sha = 'a'.repeat(64);
  const { downloadUrl, metadata } = buildVersionMetadata(specialConfig, {
    version: '0.2.0',
    changelog: 'Release notes',
    sha256: sha,
    size: 123456,
    forceUpdate: true,
    fileName: 'custom idea@win-latest.exe',
  });

  assert.equal(
    downloadUrl,
    buildDownloadUrl(specialConfig, 'custom idea@win-latest.exe')
  );
  assert.equal(
    downloadUrl,
    'https://gitlab.example.com/api/v4/projects/group%2Fsub%20project/packages/generic/custom%20idea%40win/latest/custom%20idea%40win-latest.exe'
  );
  assert.equal(metadata.downloadUrl, downloadUrl);
  assert.equal(metadata.sha256, sha);
  assert.equal(metadata.forceUpdate, true);
  assert.equal(metadata.size, 123456);
});

test('getGitLabPackages and deletePackage URL-encode namespaced projectId', async () => {
  const seenPaths = [];
  const mockHttp = {
    request(options, callback) {
      seenPaths.push({ method: options.method, path: options.path });
      return {
        on() {},
        end() {
          const handlers = {};
          callback({
            statusCode: options.method === 'DELETE' ? 204 : 200,
            on(ev, fn) { handlers[ev] = fn; },
          });
          if (handlers.data && options.method === 'GET') handlers.data('[]');
          if (handlers.end) handlers.end();
        },
      };
    },
  };

  const cfg = {
    host: 'gitlab.example.com',
    projectId: 'group/sub project',
    packageName: 'custom idea@win',
    token: 'tok',
    allowSelfSignedTls: false,
  };
  const pkgRes = await getGitLabPackages(cfg, mockHttp);
  assert.equal(pkgRes.ok, true);
  const delRes = await deletePackage(cfg, 42, 'latest', mockHttp);
  assert.equal(delRes.ok, true);

  assert.equal(seenPaths[0].path, '/api/v4/projects/group%2Fsub%20project/packages?package_name=custom%20idea%40win&per_page=100');
  assert.equal(seenPaths[1].path, '/api/v4/projects/group%2Fsub%20project/packages/42');
});
