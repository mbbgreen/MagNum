




const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MAGNUM_DIR = path.join(ROOT, 'MagNum');
const INSTALLER_DIR = path.join(ROOT, 'installer');
const RELEASE_DIR = path.join(MAGNUM_DIR, 'src-tauri', 'target', 'release');
const PAYLOAD_DIR = path.join(ROOT, 'target', 'release');
const PAYLOAD_ZIP = path.join(PAYLOAD_DIR, 'app_payload.zip');
const STAGE_DIR = path.join(ROOT, 'target', 'payload_stage');

function run(cmd, cwd) {
  console.log(`\n> ${cmd}  (cwd: ${cwd})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function stagePayload() {
  console.log('\n[2/4] Staging payload files...');
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  fs.mkdirSync(PAYLOAD_DIR, { recursive: true });

  const exe = path.join(RELEASE_DIR, 'magnum.exe');
  if (!fs.existsSync(exe)) {
    throw new Error(`Missing built binary: ${exe}`);
  }
  fs.copyFileSync(exe, path.join(STAGE_DIR, 'magnum.exe'));

  const backendSrc = path.join(MAGNUM_DIR, 'src-tauri', 'resources', 'backend');
  const backendDst = path.join(STAGE_DIR, 'backend');
  if (fs.existsSync(backendSrc)) {
    fs.cpSync(backendSrc, backendDst, { recursive: true });
    console.log(`  backend/ copied from ${backendSrc}`);
  } else {
    console.warn(`  WARNING: backend resources not found at ${backendSrc}`);
  }
}

function zipPayload() {
  console.log('\n[3/4] Compressing payload -> app_payload.zip');
  if (fs.existsSync(PAYLOAD_ZIP)) fs.rmSync(PAYLOAD_ZIP, { force: true });
  const ps = `powershell -NoProfile -Command "Compress-Archive -Path '${STAGE_DIR}\\*' -DestinationPath '${PAYLOAD_ZIP}' -CompressionLevel Optimal -Force"`;
  execSync(ps, { stdio: 'inherit' });
  const sizeMb = (fs.statSync(PAYLOAD_ZIP).size / (1024 * 1024)).toFixed(2);
  console.log(`  app_payload.zip ready (${sizeMb} MB)`);
}

function syncVersions() {
  const magnumConfPath = path.join(MAGNUM_DIR, 'src-tauri', 'tauri.conf.json');
  const conf = JSON.parse(fs.readFileSync(magnumConfPath, 'utf8'));
  const ver = conf.version || '0.1.0';

  
  const instConfPath = path.join(INSTALLER_DIR, 'src-tauri', 'tauri.conf.json');
  if (fs.existsSync(instConfPath)) {
    const instConf = JSON.parse(fs.readFileSync(instConfPath, 'utf8'));
    instConf.version = ver;
    fs.writeFileSync(instConfPath, JSON.stringify(instConf, null, 2), 'utf8');
  }

  
  const instCargoPath = path.join(INSTALLER_DIR, 'src-tauri', 'Cargo.toml');
  if (fs.existsSync(instCargoPath)) {
    let cargo = fs.readFileSync(instCargoPath, 'utf8');
    cargo = cargo.replace(/version = "[^"]+"/, `version = "${ver}"`);
    fs.writeFileSync(instCargoPath, cargo, 'utf8');
  }

  return ver;
}

function signInstaller(setupExe, version) {
  const keyPath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.tauri', 'magnum.key');
  if (!fs.existsSync(keyPath)) {
    console.warn(`\n[!] Private key not found at ${keyPath} - skipping auto-sign.`);
    return;
  }

  console.log(`\n[5/5] Signing installer for version ${version}...`);
  try {
    const signCmd = `npx @tauri-apps/cli signer sign -f "${keyPath}" --app-version ${version} "${setupExe}"`;
    execSync(signCmd, { cwd: MAGNUM_DIR, stdio: 'inherit' });
    const sigFile = `${setupExe}.sig`;
    if (fs.existsSync(sigFile)) {
      const sig = fs.readFileSync(sigFile, 'utf8').trim();
      console.log('\n======================================================');
      console.log('✅ SIGNATURE GENERATED SUCCESSFULLY:');
      console.log(sig);
      console.log('======================================================');
    }
  } catch (err) {
    console.warn('  Auto-signing failed:', err.message);
  }
}

function main() {
  console.log('=== MagNum Modern Installer Build ===');
  const version = syncVersions();
  console.log(`Target Version: ${version}`);

  console.log('\n[1/4] Building main MagNum app (tauri build)...');
  run('npm run tauri build', MAGNUM_DIR);

  stagePayload();
  zipPayload();

  console.log('\n[4/4] Building custom MagNum installer...');
  run('npm run tauri build', INSTALLER_DIR);

  const rawExe = path.join(INSTALLER_DIR, 'src-tauri', 'target', 'release', 'magnum-installer.exe');
  const setupExe = path.join(INSTALLER_DIR, 'src-tauri', 'target', 'release', 'MagNum-Setup.exe');
  if (fs.existsSync(rawExe)) {
    fs.copyFileSync(rawExe, setupExe);
  }

  signInstaller(setupExe, version);

  console.log('\n🎉 DONE! Modern installer generated at:');
  console.log(`  ${setupExe}`);
  console.log(`  ${setupExe}.sig`);
}

main();
