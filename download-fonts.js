const fs = require('fs');
const path = require('path');
const https = require('https');

const CSS_URL = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Vazirmatn:wght@300;400;500;600;700;800&display=swap';
const TARGET_DIR = path.join(__dirname, 'MagNum', 'src', 'assets', 'fonts');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out: ' + url));
    });
  });
}

function downloadBinary(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return resolve(downloadBinary(res.headers.location, destPath));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    req.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      fs.unlink(destPath, () => {});
      reject(new Error('Timeout downloading ' + url));
    });
  });
}

async function main() {
  console.log('Fetching Google Fonts CSS...');
  const css = await fetchText(CSS_URL);
  console.log(`Fetched CSS (${css.length} bytes).`);

  
  const urlRegex = /url\((https:\/\/[^)]+)\)/g;
  let match;
  const urlMap = new Map();
  let index = 0;

  while ((match = urlRegex.exec(css)) !== null) {
    const remoteUrl = match[1];
    if (!urlMap.has(remoteUrl)) {
      const ext = path.extname(new URL(remoteUrl).pathname) || '.woff2';
      const filename = `font_${index++}${ext}`;
      urlMap.set(remoteUrl, filename);
    }
  }

  console.log(`Found ${urlMap.size} font files to download.`);

  for (const [remoteUrl, filename] of urlMap.entries()) {
    const dest = path.join(TARGET_DIR, filename);
    console.log(`Downloading ${filename} from ${remoteUrl}...`);
    await downloadBinary(remoteUrl, dest);
  }

  console.log('All fonts downloaded successfully!');

  
  let localCss = css;
  for (const [remoteUrl, filename] of urlMap.entries()) {
    localCss = localCss.split(remoteUrl).join(`./assets/fonts/${filename}`);
  }

  const fontsCssPath = path.join(__dirname, 'MagNum', 'src', 'fonts.css');
  fs.writeFileSync(fontsCssPath, localCss, 'utf8');
  console.log(`Wrote offline fonts CSS to ${fontsCssPath}`);
}

main().catch(err => {
  console.error('Download error:', err);
  process.exit(1);
});
