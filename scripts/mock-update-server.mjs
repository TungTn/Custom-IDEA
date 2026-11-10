/**
 * MOCK UPDATE SERVER FOR LOCAL TESTING (MIC Studio Standard)
 * Chạy server HTTP cục bộ giả lập GitLab Package Registry tại http://localhost:3344
 * 
 * Cách chạy:
 *   node scripts/mock-update-server.mjs
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const PORT = 3344;
const mockExePath = path.join(projectRoot, 'dist-portable', 'Custom-IDEA-Portable.exe');

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) {
    return '0000000000000000000000000000000000000000000000000000000000000000';
  }
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  console.log(`[Mock Server] ${req.method} ${url.pathname}${url.search}`);

  if (url.pathname === '/version.json') {
    const sha256 = getFileHash(mockExePath);
    const size = fs.existsSync(mockExePath) ? fs.statSync(mockExePath).size : 1024;

    const metadata = {
      version: '0.2.0',
      releaseDate: new Date().toISOString(),
      notes: "• [Tính năng mới] Tích hợp hệ thống Auto Update qua Package Registry\n• [Giao diện] Modal cập nhật chuẩn phong cách JetBrains Darcula New UI\n• [Tối ưu] Hoán đổi tệp nhị phân tức thì bằng Atomic Swapper script tự hủy\n• [Bảo mật] Kiểm tra tính toàn vẹn tệp nghiêm ngặt với SHA-256",
      sha256: sha256,
      downloadUrl: `http://localhost:${PORT}/custom-idea-latest.exe`,
      size: size,
      forceUpdate: url.searchParams.get('force') === 'true',
      requireSetup: false
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metadata, null, 2));
    return;
  }

  if (url.pathname === '/custom-idea-latest.exe') {
    if (!fs.existsSync(mockExePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found. Please run pnpm run build:portable first.');
      return;
    }

    const stat = fs.statSync(mockExePath);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="custom-idea-latest.exe"'
    });

    const readStream = fs.createReadStream(mockExePath, { highWaterMark: 1024 * 512 }); // 512KB chunks
    readStream.pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(` [MOCK UPDATE SERVER] Đang lắng nghe tại http://localhost:${PORT}`);
  console.log(` - Metadata URL: http://localhost:${PORT}/version.json`);
  console.log(` - Test Force Update: http://localhost:${PORT}/version.json?force=true`);
  console.log(` - Binary Download: http://localhost:${PORT}/custom-idea-latest.exe`);
  console.log('================================================================');
});
