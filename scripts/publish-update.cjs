/**
 * ===============================================================================
 * SCRIPT PHÁT HÀNH BẢN CẬP NHẬT TỰ ĐỘNG LÊN GITLAB.MIC.VN (GENERIC PACKAGE)
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
    host: env.GITLAB_HOST || 'gitlab.mic.vn',
    projectId: env.GITLAB_PROJECT_ID,
    token: env.GITLAB_TOKEN,
    packageName: env.PACKAGE_NAME || 'custom-idea'
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
function getGitLabPackages(config) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: config.host,
      port: 443,
      path: `/api/v4/projects/${config.projectId}/packages?package_name=${encodeURIComponent(config.packageName)}&per_page=100`,
      method: 'GET',
      headers: { 'PRIVATE-TOKEN': config.token },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(res.statusCode >= 200 && res.statusCode < 300 ? JSON.parse(data) : []);
        } catch (_) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// 4. LẤY DANH SÁCH TỆP TIN TRONG MỘT PACKAGE
function getPackageFiles(config, packageId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: config.host,
      port: 443,
      path: `/api/v4/projects/${config.projectId}/packages/${packageId}/package_files?per_page=100`,
      method: 'GET',
      headers: { 'PRIVATE-TOKEN': config.token },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(res.statusCode >= 200 && res.statusCode < 300 ? JSON.parse(data) : []);
        } catch (_) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// 5. XÓA MỘT TỆP TIN CỤ THỂ KHỎI PACKAGE (DELETE API)
function deletePackageFile(config, packageId, fileId, fileName) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: config.host,
      port: 443,
      path: `/api/v4/projects/${config.projectId}/packages/${packageId}/package_files/${fileId}`,
      method: 'DELETE',
      headers: { 'PRIVATE-TOKEN': config.token },
      rejectUnauthorized: false
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[*] [DỌN DẸP] Đã xóa tệp cũ: ${fileName} (File ID: ${fileId})`);
      }
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

// 6. XÓA HẲN MỘT PACKAGE PHIÊN BẢN CŨ KHỎI GITLAB (DELETE API)
function deletePackage(config, packageId, version) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: config.host,
      port: 443,
      path: `/api/v4/projects/${config.projectId}/packages/${packageId}`,
      method: 'DELETE',
      headers: { 'PRIVATE-TOKEN': config.token },
      rejectUnauthorized: false
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[*] [DỌN DẸP] Đã xóa package phiên bản cũ: v${version} (ID: ${packageId})`);
      }
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

// 7. CƠ CHẾ DỌN DẸP TRIỆT ĐỂ: XÓA SẠCH BẢN CŨ TRƯỚC KHI TẢI BẢN MỚI
async function purgeOldReleases(config) {
  console.log('\n[*] Bắt đầu kiểm tra và dọn dẹp triệt để các tệp/package cũ trên GitLab...');
  try {
    const packages = await getGitLabPackages(config);

    // Bước A: Xóa toàn bộ các package phiên bản cũ khác "latest"
    const nonLatestPackages = packages.filter((p) => p.name === config.packageName && p.version !== 'latest');
    for (const oldPkg of nonLatestPackages) {
      await deletePackage(config, oldPkg.id, oldPkg.version);
    }

    // Bước B: Dọn sạch toàn bộ các tệp tin hiện có trong package "latest"
    const latestPkg = packages.find((p) => p.name === config.packageName && p.version === 'latest');
    if (latestPkg) {
      const files = await getPackageFiles(config, latestPkg.id);
      for (const file of files) {
        await deletePackageFile(config, latestPkg.id, file.id, file.file_name);
      }
      console.log(`[OK] Đã dọn sạch toàn bộ tệp cũ trong package '${config.packageName}:latest'.`);
    } else {
      console.log(`[*] Package '${config.packageName}:latest' chưa có hoặc đang trống.`);
    }
  } catch (err) {
    console.warn(`[!] Cảnh báo dọn dẹp: ${err.message}`);
  }
}

// 8. UPLOAD TỆP TIN LÊN GITLAB GENERIC PACKAGE REGISTRY (DẠNG STREAM)
function uploadFileToGitLab(config, filePath, remoteFileName) {
  return new Promise((resolve) => {
    const stat = fs.statSync(filePath);
    const apiPath = `/api/v4/projects/${config.projectId}/packages/generic/${encodeURIComponent(config.packageName)}/latest/${encodeURIComponent(remoteFileName)}`;

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
      rejectUnauthorized: false
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

// 9. HÀM CHÍNH THỰC THI (MAIN PIPELINE)
async function main() {
  const config = loadEnv();

  if (!config.projectId || !config.token) {
    console.error('[LỖI] Vui lòng cấu hình GITLAB_PROJECT_ID và GITLAB_TOKEN trong file .env');
    process.exit(1);
  }

  // Đọc version mặc định từ package.json nếu không truyền
  let pkgVersion = '0.1.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    if (pkg.version) pkgVersion = pkg.version;
  } catch (_) {}

  const args = process.argv.slice(2);
  const version = args[0] || pkgVersion;
  const changelog = args[1] || 'Cập nhật phiên bản mới và tối ưu hiệu năng';
  const isForceUpdate = args[2] !== undefined ? args[2] === 'true' || args[2] === '1' : false;

  console.log('===============================================================================');
  console.log('    XUẤT BẢN BẢN CẬP NHẬT LÊN GITLAB.MIC.VN (GENERIC PACKAGE)');
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
  const candidateExePaths = [
    path.join(projectRoot, 'target', 'release', 'app.exe'),
    path.join(projectRoot, 'dist-portable', 'Custom-IDEA-Portable.exe'),
    path.join(releaseDir, `${config.packageName}.exe`),
    path.join(releaseDir, 'Custom-IDEA-Portable.exe')
  ];

  const existingCandidates = candidateExePaths
    .filter((p) => fs.existsSync(p))
    .map((p) => ({ path: p, mtime: fs.statSync(p).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  let sourceExePath = existingCandidates.length > 0 ? existingCandidates[0].path : null;

  if (!sourceExePath) {
    console.error(`[LỖI] Không tìm thấy tệp nhị phân thực thi (.exe) sau build!`);
    console.error(`Đã tìm kiếm tại:`);
    candidateExePaths.forEach((p) => console.error(`  - ${p}`));
    console.error(`\nVui lòng biên dịch ứng dụng trước bằng lệnh: npm run build:portable`);
    process.exit(1);
  }

  console.log(`[*] Tìm thấy tệp nhị phân nguồn: ${sourceExePath}`);

  // THIẾT LUẬT 3: TÊN FILE BẮT BUỘC DÙNG HẬU TỐ "-latest.exe" (KHÔNG CHỨA SỐ VERSION)
  const latestExeFileName = `${config.packageName}-latest.exe`;
  const latestExePath = path.join(releaseDir, latestExeFileName);

  // Sao chép sang định dạng tên file chuẩn -latest
  fs.copyFileSync(sourceExePath, latestExePath);

  // BƯỚC 1: DỌN DẸP SẠCH TOÀN BỘ CÁC TỆP CŨ VÀ PACKAGE CŨ TRÊN GITLAB
  await purgeOldReleases(config);

  // BƯỚC 2: TÍNH TOÁN SHA-256 CHO TỆP -latest.exe
  console.log('\n[1/3] Đang tính toán mã băm SHA-256 dạng stream...');
  const sha256 = await calculateSha256(latestExePath);
  const exeStat = fs.statSync(latestExePath);
  console.log(`[*] Tệp phát hành: ${latestExeFileName} (${(exeStat.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`[*] Mã băm SHA-256 : ${sha256}`);

  // BƯỚC 3: TẠO METADATA version.json MỚI NHẤT
  console.log('\n[2/3] Đang tạo metadata version.json...');
  const downloadUrl = `https://${config.host}/api/v4/projects/${config.projectId}/packages/generic/${config.packageName}/latest/${latestExeFileName}`;

  const versionMetadata = {
    version: version,
    releaseDate: new Date().toISOString(),
    notes: changelog,
    sha256: sha256,
    downloadUrl: downloadUrl,
    size: exeStat.size,
    forceUpdate: isForceUpdate,
    requireSetup: false
  };

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
    console.log(' [THÀNH CÔNG RỰC RỠ] ĐÃ PHÁT HÀNH BẢN CẬP NHẬT LÊN GITLAB.MIC.VN!');
    console.log(` - Mục Package : ${config.packageName}`);
    console.log(` - Metadata URL: https://${config.host}/api/v4/projects/${config.projectId}/packages/generic/${config.packageName}/latest/version.json`);
    console.log(` - Download URL: ${downloadUrl}`);
    console.log('===============================================================================');
  } else {
    console.error('\n[LỖI NGHIÊM TRỌNG] Upload lên GitLab thất bại!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
