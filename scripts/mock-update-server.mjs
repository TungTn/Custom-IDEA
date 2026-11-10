/**
 * MOCK UPDATE SERVER FOR LOCAL TESTING
 * Chạy server HTTP cục bộ giả lập GitLab Package Registry tại http://localhost:3344
 *
 * Cách chạy:
 *   node scripts/mock-update-server.mjs
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_PORT = 3344;
const defaultExePath = path.join(projectRoot, 'dist-portable', 'Custom-IDEA-Portable.exe');

function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

export function createMockUpdateServer({ exePath = defaultExePath, defaultVersion = '0.2.0', quiet = false } = {}) {
  return http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const hostHeader = req.headers.host || `localhost:${DEFAULT_PORT}`;
    let url;
    try {
      url = new URL(req.url || '/', `http://${hostHeader}`);
    } catch (_) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad Request');
      return;
    }

    if (!quiet) {
      console.log(`[Mock Server] ${req.method} ${url.pathname}${url.search}`);
    }

    if (url.pathname === '/version.json') {
      if (url.searchParams.get('fail') === '500') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Simulated Server Error');
        return;
      }
      if (!fs.existsSync(exePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Portable exe not found. Please build first.');
        return;
      }

      const realSha = getFileHash(exePath);
      const sha256 =
        url.searchParams.get('badsha') === 'true'
          ? 'deadbeef'.repeat(8)
          : realSha;
      const size = fs.statSync(exePath).size;
      const version = url.searchParams.get('version') || defaultVersion;

      const metadata = {
        version,
        releaseDate: new Date().toISOString(),
        notes: '• [Tính năng mới] Tích hợp hệ thống Auto Update qua Package Registry\n• [Giao diện] Modal cập nhật chuẩn phong cách JetBrains Darcula New UI\n• [Tối ưu] Hoán đổi tệp nhị phân tức thì bằng Atomic Swapper script tự hủy\n• [Bảo mật] Kiểm tra tính toàn vẹn tệp nghiêm ngặt với SHA-256',
        sha256,
        downloadUrl: `http://${hostHeader}/custom-idea-latest.exe`,
        size,
        forceUpdate: url.searchParams.get('force') === 'true',
        requireSetup: false
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metadata, null, 2));
      return;
    }

    if (url.pathname === '/custom-idea-latest.exe') {
      if (!fs.existsSync(exePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found. Please run pnpm run build:portable first.');
        return;
      }

      const stat = fs.statSync(exePath);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="custom-idea-latest.exe"'
      });

      const readStream = fs.createReadStream(exePath, { highWaterMark: 1024 * 512 });
      readStream.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(err.message);
        } else {
          res.destroy(err);
        }
      });
      res.on('close', () => {
        readStream.destroy();
      });
      readStream.pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createMockUpdateServer();
  server.listen(DEFAULT_PORT, () => {
    console.log('================================================================');
    console.log(` [MOCK UPDATE SERVER] Đang lắng nghe tại http://localhost:${DEFAULT_PORT}`);
    console.log(` - Metadata URL     : http://localhost:${DEFAULT_PORT}/version.json`);
    console.log(` - Force Update     : http://localhost:${DEFAULT_PORT}/version.json?force=true`);
    console.log(` - Bad SHA-256 Test : http://localhost:${DEFAULT_PORT}/version.json?badsha=true`);
    console.log(` - Binary Download  : http://localhost:${DEFAULT_PORT}/custom-idea-latest.exe`);
    console.log('================================================================');
  });
}
