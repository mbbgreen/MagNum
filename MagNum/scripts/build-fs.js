import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');                       // MagNum/
const crateDir = path.join(root, 'src-tauri', 'magnum-fs');
const manifest = path.join(crateDir, 'Cargo.toml');

const bin = process.platform === 'win32' ? 'magnum-fs.exe' : 'magnum-fs';
const src = path.join(crateDir, 'target', 'release', bin);
const dst = path.join(root, 'src-tauri', 'resources', 'backend', bin);

if (!fs.existsSync(manifest)) {
  console.error(`[magnum-fs] Cargo.toml not found: ${manifest}`);
  process.exit(1);
}

// اگر باینری از سورس تازه‌تر است، دوباره cargo اجرا نکن (dev سریع بماند)
const sources = [manifest, path.join(crateDir, 'src', 'main.rs')];
const newestSrc = Math.max(...sources.map(f => fs.statSync(f).mtimeMs));
const upToDate = fs.existsSync(dst) && fs.statSync(dst).mtimeMs > newestSrc;

if (upToDate && process.env.FORCE_FS_BUILD !== '1') {
  console.log('[magnum-fs] up-to-date — skipping cargo build.');
  process.exit(0);
}

console.log('[magnum-fs] cargo build --release ...');
execSync(`cargo build --release --manifest-path "${manifest}"`, { stdio: 'inherit' });

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log(`[magnum-fs] installed -> ${dst} (${(fs.statSync(dst).size / 1024).toFixed(0)} KB)`);