/**
 * ===============================================================================
 * SCRIPT PHÁT HÀNH BẢN CẬP NHẬT TỰ ĐỘNG LÊN GITLAB (GENERIC PACKAGE REGISTRY)
 * ===============================================================================
 * Thiết luật tuân thủ (MIC Studio Standard):
 *   1. Tuyệt đối CẤM commit file nhị phân vào Git repo.
 *   2. Mỗi ứng dụng sở hữu đúng 1 Package độc lập (Package Name = PACKAGE_NAME, Version = "latest").
 *   3. Tên file nhị phân bắt buộc có hậu tố "-latest.exe" (không chứa số version).
 *   4. Xóa sạch 100% mọi tệp cũ và package phiên bản cũ trước khi tải tệp mới lên (Purge & Clean).
 *
 * Hướng dẫn chạy:
 *   node scripts/publish-update.cjs [version] [changelog] [forceUpdate: true|false]
 * Ví dụ:
 *   node scripts/publish-update.cjs 0.1.1 "Sửa lỗi và tối ưu hóa giao diện" false
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

// 1. ĐỌC CẤU HÌNH MÔI TRƯỜNG TỪ FILE .ENV
function loadEnv() {
  const envPath = path.join(projectRoot, '.env');
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const k = trimmed.substring(0, eqIdx).trim();
        const v = trimmed.substring(eqIdx + 1).trim();
        env[k] = v;
      }
    }
  }
  return {
    host: env.GITLAB_HOST || 'gitlab.example.com',
    projectId: env.GITLAB_PROJECT_ID,
    token: env.GITLAB_TOKEN,
    packageName: env.PACKAGE_NAME || 'custom-idea',
    allowSelfSignedTls: env.ALLOW_SELF_SIGNED_TLS === 'true'
  };
}

// 2. TÍNH MÃ BĂM SHA-256 DẠNG STREAM (TỐI ƯU BỘ NHỚ RAM)
function calculateSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

// 3. GỌI API GITLAB ĐỂ LẤY DANH SÁCH PACKAGES CỦA DỰ ÁN
function getGitLabPackages(config, httpClient = https) {
  return new Promise((resolve) => {
    const req = httpClient.request({
      hostname: config.host,
      port: 443,
      path: `/api/v4/projects/${encodeURIComponent(config.projectId)}/packages?package_name=${encodeURIComponent(config.packageName)}&per_page=100`,
      method: 'GET',
      headers: { 'PRIVATE-TOKEN': config.token },
      rejectUnauthorized: !config.allowSelfSignedTls
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve({ ok: true, statusCode: res.statusCode, packages: Array.isArray(parsed) ? parsed : [] });
          } catch (err) {
            resolve({ ok: false, statusCode: res.statusCode, packages: [], message: `JSON parse error: ${err.message}` });
          }
        } else {
          resolve({ ok: false, statusCode: res.statusCode, packages: [], message: data });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, statusCode: 0, packages: [], message: err.message }));
    req.end();
  });
}

// 4. XÓA HẲN MỘT PACKAGE PHIÊN BẢN CŨ KHỎI GITLAB (DELETE API)
function deletePackage(config, packageId, version, httpClient = https) {
  return new Promise((resolve) => {
    const req = httpClient.request({
      hostname: config.host,
      port: 443,
      path: `/api/v4/projects/${encodeURIComponent(config.projectId)}/packages/${encodeURIComponent(String(packageId))}`,
      method: 'DELETE',
      headers: { 'PRIVATE-TOKEN': config.token },
      rejectUnauthorized: !config.allowSelfSignedTls
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[*] [DỌN DẸP] Đã xóa package phiên bản cũ: v${version} (ID: ${packageId})`);
          resolve({ ok: true, statusCode: res.statusCode });
        } else if (res.statusCode === 404) {
          resolve({ ok: true, statusCode: 404 });
        } else {
          resolve({ ok: false, statusCode: res.statusCode, message: body });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, statusCode: 0, message: err.message }));
    req.end();
  });
}

// 5. CƠ CHẾ DỌN DẸP TRIỆT ĐỂ: XÓA SẠCH PACKAGE CŨ TRƯỚC KHI TẢI BẢN MỚI
async function purgeOldReleases(config, httpClient = https) {
  console.log('\n[*] Bắt đầu kiểm tra và dọn dẹp triệt để các package cũ trên GitLab...');
  const listRes = await getGitLabPackages(config, httpClient);
  if (!listRes.ok) {
    console.warn(`[!] Không thể liệt kê package cũ (HTTP ${listRes.statusCode}): ${listRes.message || 'Unknown error'}`);
    return { ok: false, reason: 'list_failed', statusCode: listRes.statusCode, message: listRes.message };
  }

  const existingPackages = listRes.packages.filter((p) => p.name === config.packageName);
  if (existingPackages.length === 0) {
    console.log(`[*] Chưa có package nào của '${config.packageName}' trên máy chủ.`);
    return { ok: true, deletedCount: 0 };
  }

  const failures = [];
  let deletedCount = 0;
  for (const pkg of existingPackages) {
    const delRes = await deletePackage(config, pkg.id, pkg.version, httpClient);
    if (delRes.ok) {
      deletedCount += 1;
    } else {
      failures.push({ id: pkg.id, version: pkg.version, statusCode: delRes.statusCode, message: delRes.message });
    }
  }

  if (failures.length > 0) {
    for (const f of failures) {
      const hint = f.statusCode === 403 ? ' (cần token quyền Maintainer/Owner để xóa Package)' : '';
      console.warn(`[!] Xóa package v${f.version} (ID: ${f.id}) thất bại (HTTP ${f.statusCode})${hint}: ${f.message || ''}`);
    }
    return { ok: false, reason: 'delete_failed', failures, deletedCount };
  }

  console.log(`[OK] Đã dọn sạch ${deletedCount} package cũ của '${config.packageName}'.`);
  return { ok: true, deletedCount };
}

// 6. UPLOAD TỆP TIN LÊN GITLAB GENERIC PACKAGE REGISTRY (DẠNG STREAM)
function uploadFileToGitLab(config, filePath, remoteFileName) {
  return new Promise((resolve) => {
    const stat = fs.statSync(filePath);
    const apiPath = `/api/v4/projects/${encodeURIComponent(config.projectId)}/packages/generic/${encodeURIComponent(config.packageName)}/latest/${encodeURIComponent(remoteFileName)}`;

    console.log(`[*] Đang tải lên: ${remoteFileName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);

    const req = https.request({
      hostname: config.host,
      port: 443,
      path: apiPath,
      method: 'PUT',
      headers: {
        'PRIVATE-TOKEN': config.token,
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size
      },
      rejectUnauthorized: !config.allowSelfSignedTls
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[OK] Tải lên thành công: ${remoteFileName}`);
          resolve({ success: true });
        } else {
          console.error(`[LỖI] Upload thất bại (HTTP ${res.statusCode}):`, body);
          resolve({ success: false, error: body });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[LỖI] Lỗi kết nối khi upload ${remoteFileName}:`, err.message);
      resolve({ success: false, error: err.message });
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (err) => {
      req.destroy();
      resolve({ success: false, error: err.message });
    });
    fileStream.pipe(req);
  });
}

// 8.1. TỰ ĐỘNG ĐỒNG BỘ VERSION VÀO CẢ 3 TỆP (package.json, tauri.conf.json, Cargo.toml)
function bumpProjectVersions(targetVersion) {
  console.log(`\n[*] Bắt đầu tự động đồng bộ version v${targetVersion} vào các tệp cấu hình dự án...`);

  // 1. package.json
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version !== targetVersion) {
        pkg.version = targetVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        console.log(`  [✓] Đã cập nhật package.json -> v${targetVersion}`);
      } else {
        console.log(`  [-] package.json đã ở version v${targetVersion}`);
      }
    } catch (e) {
      console.warn(`  [!] Lỗi cập nhật package.json: ${e.message}`);
    }
  }

  // 2. src-tauri/tauri.conf.json
  const tauriConfPath = path.join(projectRoot, 'src-tauri', 'tauri.conf.json');
  if (fs.existsSync(tauriConfPath)) {
    try {
      const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
      if (tauriConf.version !== targetVersion) {
        tauriConf.version = targetVersion;
        fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
        console.log(`  [✓] Đã cập nhật src-tauri/tauri.conf.json -> v${targetVersion}`);
      } else {
        console.log(`  [-] src-tauri/tauri.conf.json đã ở version v${targetVersion}`);
      }
    } catch (e) {
      console.warn(`  [!] Lỗi cập nhật tauri.conf.json: ${e.message}`);
    }
  }

  // 3. Cargo.toml ([workspace.package])
  const cargoPath = path.join(projectRoot, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    try {
      const cargoContent = fs.readFileSync(cargoPath, 'utf8');
      const updated = cargoContent.replace(
        /(\[workspace\.package\][\s\S]*?version\s*=\s*")[^"]+(")/,
        `$1${targetVersion}$2`
      );
      if (updated !== cargoContent) {
        fs.writeFileSync(cargoPath, updated, 'utf8');
        console.log(`  [✓] Đã cập nhật Cargo.toml -> v${targetVersion}`);
      } else {
        console.log(`  [-] Cargo.toml đã ở version v${targetVersion}`);
      }
    } catch (e) {
      console.warn(`  [!] Lỗi cập nhật Cargo.toml: ${e.message}`);
    }
  }
}

// 8.2. BIÊN DỊCH BẢN PHÁT HÀNH MỚI BẰNG PNPM
function buildPortableBinary() {
  console.log('\n[*] Kích hoạt biên dịch bản phát hành độc lập mới bằng pnpm...');
  console.log('    Lệnh: pnpm run build:portable\n');
  try {
    execSync('pnpm run build:portable', {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('\n[OK] Biên dịch bản mới thành công!');
  } catch (err) {
    console.error('\n[LỖI] Quá trình biên dịch binary thất bại:', err.message);
    process.exit(1);
  }
}

// 9. HÀM CHÍNH THỰC THI (MAIN PIPELINE)
async function main() {
  const config = loadEnv();

  if (!config.projectId || !config.token) {
    console.error('[LỖI] Vui lòng cấu hình GITLAB_PROJECT_ID và GITLAB_TOKEN trong file .env');
    process.exit(1);
  }

  // Đọc version hiện tại từ package.json
  let pkgVersion = '0.1.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    if (pkg.version) pkgVersion = pkg.version;
  } catch (_) {}

  const args = process.argv.slice(2);
  const positionalArgs = args.filter((a) => !a.startsWith('--'));
  const rawVersion = positionalArgs[0];
  const changelog = positionalArgs[1] || 'Cập nhật phiên bản mới và tối ưu hiệu năng';
  const isForceUpdate = positionalArgs[2] !== undefined ? positionalArgs[2] === 'true' || positionalArgs[2] === '1' : false;

  const shouldSkipBuild = args.includes('--no-build');
  const shouldForceBuild = args.includes('--build');
  const allowDirtyRegistry = args.includes('--allow-dirty-registry');

  const version = rawVersion || pkgVersion;
  const isVersionChanged = rawVersion && rawVersion !== pkgVersion;

  // Tự động đồng bộ version vào cả 3 file nếu có version được truyền vào
  if (rawVersion) {
    bumpProjectVersions(version);
  }

  // Tự động build lại binary nếu:
  // 1. Version có thay đổi so với package.json cũ
  // 2. Có cờ --build
  // 3. Chưa có file .exe nào
  const candidateExePaths = [
    path.join(projectRoot, 'dist-portable', 'Custom-IDEA-Portable.exe'),
    path.join(projectRoot, 'target', 'release', 'app.exe'),
  ];
  const hasExistingExe = candidateExePaths.some((p) => fs.existsSync(p));

  if (!shouldSkipBuild && (isVersionChanged || shouldForceBuild || !hasExistingExe)) {
    console.log(`\n[*] Cần biên dịch phiên bản mới v${version} để nhúng đúng version vào binary...`);
    buildPortableBinary();
  }

  console.log('===============================================================================');
  console.log(`    XUẤT BẢN BẢN CẬP NHẬT LÊN ${config.host.toUpperCase()} (GENERIC PACKAGE)`);
  console.log('===============================================================================');
  console.log(`- Máy chủ GitLab       : https://${config.host}`);
  console.log(`- Project ID           : ${config.projectId}`);
  console.log(`- Mục Package (App)    : ${config.packageName}`);
  console.log(`- Phiên bản phát hành  : v${version}`);
  console.log(`- Ghi chú cập nhật     : ${changelog}`);
  console.log(`- Chế độ cập nhật      : ${isForceUpdate ? '🔴 BẮT BUỘC (FORCE UPDATE)' : '🟢 TÙY CHỌN'}`);
  console.log('-------------------------------------------------------------------------------');

  // ĐẢM BẢO THƯ MỤC release TỒN TẠI
  const releaseDir = path.join(projectRoot, 'release');
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  // TÌM TỆP THỰC THI NHỊ PHÂN NGUỒN (CHỌN FILE MỚI NHẤT ĐÃ ĐƯỢC BIÊN DỊCH)
  const fullCandidatePaths = [
    path.join(projectRoot, 'target', 'release', 'app.exe'),
    path.join(projectRoot, 'dist-portable', 'Custom-IDEA-Portable.exe'),
    path.join(releaseDir, `${config.packageName}.exe`),
    path.join(releaseDir, 'Custom-IDEA-Portable.exe')
  ];

  const existingCandidates = fullCandidatePaths
    .filter((p) => fs.existsSync(p))
    .map((p) => ({ path: p, mtime: fs.statSync(p).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  let sourceExePath = existingCandidates.length > 0 ? existingCandidates[0].path : null;

  if (!sourceExePath) {
    console.error(`[LỖI] Không tìm thấy tệp nhị phân thực thi (.exe) sau build!`);
    console.error(`Đã tìm kiếm tại:`);
    fullCandidatePaths.forEach((p) => console.error(`  - ${p}`));
    console.error(`\nVui lòng biên dịch ứng dụng trước bằng lệnh: pnpm run build:portable`);
    process.exit(1);
  }

  console.log(`[*] Tìm thấy tệp nhị phân nguồn: ${sourceExePath}`);

  // THIẾT LUẬT 3: TÊN FILE BẮT BUỘC DÙNG HẬU TỐ "-latest.exe" (KHÔNG CHỨA SỐ VERSION)
  const latestExeFileName = `${config.packageName}-latest.exe`;
  const latestExePath = path.join(releaseDir, latestExeFileName);

  // Sao chép sang định dạng tên file chuẩn -latest
  fs.copyFileSync(sourceExePath, latestExePath);

  // BƯỚC 1: DỌN DẸP SẠCH TOÀN BỘ CÁC TỆP CŨ VÀ PACKAGE CŨ TRÊN GITLAB
  const purgeRes = await purgeOldReleases(config);
  if (!purgeRes.ok && !allowDirtyRegistry) {
    console.error('\n[LỖI] Dọn dẹp package cũ thất bại — dừng upload để tránh tạo asset trùng lặp trên GitLab.');
    console.error('      Hãy dùng token có quyền Maintainer hoặc truyền cờ --allow-dirty-registry nếu bạn chủ ý bỏ qua.');
    process.exit(1);
  }

  // BƯỚC 2: TÍNH TOÁN SHA-256 CHO TỆP -latest.exe
  console.log('\n[1/3] Đang tính toán mã băm SHA-256 dạng stream...');
  const sha256 = await calculateSha256(latestExePath);
  const exeStat = fs.statSync(latestExePath);
  console.log(`[*] Tệp phát hành: ${latestExeFileName} (${(exeStat.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`[*] Mã băm SHA-256 : ${sha256}`);

  // BƯỚC 3: TẠO METADATA version.json MỚI NHẤT
  console.log('\n[2/3] Đang tạo metadata version.json...');
  const { downloadUrl, metadata: versionMetadata } = buildVersionMetadata(config, {
    version,
    changelog,
    sha256,
    size: exeStat.size,
    forceUpdate: isForceUpdate,
    fileName: latestExeFileName,
  });

  const tempVersionPath = path.join(releaseDir, 'version.json');
  fs.writeFileSync(tempVersionPath, JSON.stringify(versionMetadata, null, 2), 'utf8');

  // BƯỚC 4: TẢI FILE MỚI LÊN GITLAB (RETRY TỐI ĐA 3 LẦN)
  console.log('\n[3/3] Đang tải lên GitLab Generic Package Registry...');
  let uploadExeOk = false;
  let uploadMetaOk = false;

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (!uploadExeOk) {
      const res = await uploadFileToGitLab(config, latestExePath, latestExeFileName);
      uploadExeOk = res.success;
    }
    if (!uploadMetaOk) {
      const res = await uploadFileToGitLab(config, tempVersionPath, 'version.json');
      uploadMetaOk = res.success;
    }

    if (uploadExeOk && uploadMetaOk) break;

    if (attempt < 3) {
      console.warn(`[!] Thử lại lần ${attempt + 1}/3 sau 3 giây...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // Dọn dẹp tệp local tạm sau khi hoàn tất
  try {
    if (fs.existsSync(latestExePath) && latestExePath !== sourceExePath) {
      fs.unlinkSync(latestExePath);
    }
  } catch (_) {}

  if (uploadExeOk && uploadMetaOk) {
    console.log('\n===============================================================================');
    console.log(` [THÀNH CÔNG] ĐÃ PHÁT HÀNH BẢN CẬP NHẬT LÊN ${config.host.toUpperCase()}!`);
    console.log(` - Mục Package : ${config.packageName}`);
    console.log(` - Metadata URL: ${buildDownloadUrl(config, 'version.json')}`);
    console.log(` - Download URL: ${downloadUrl}`);
    console.log('===============================================================================');
  } else {
    console.error('\n[LỖI NGHIÊM TRỌNG] Upload lên GitLab thất bại!');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[FATAL ERROR]:', err);
    process.exit(1);
  });
}

function buildDownloadUrl(config, fileName) {
  return `https://${config.host}/api/v4/projects/${encodeURIComponent(config.projectId)}/packages/generic/${encodeURIComponent(config.packageName)}/latest/${encodeURIComponent(fileName)}`;
}

function buildVersionMetadata(config, { version, changelog, sha256, size, forceUpdate, fileName }) {
  const downloadUrl = buildDownloadUrl(config, fileName);
  const metadata = {
    version,
    releaseDate: new Date().toISOString(),
    notes: changelog,
    sha256,
    downloadUrl,
    size,
    forceUpdate: Boolean(forceUpdate),
    requireSetup: false,
  };
  return { downloadUrl, metadata };
}

module.exports = {
  getGitLabPackages,
  deletePackage,
  purgeOldReleases,
  buildDownloadUrl,
  buildVersionMetadata,
};
