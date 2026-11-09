'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');


const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-search-engine-choice-screen',
  '--hide-crash-restore-bubble',
  '--lang=en-US',
  '--start-maximized',
];

const IGNORED_DEFAULT_ARGS = [
  '--enable-automation',
  '--disable-extensions',
  '--disable-component-extensions-with-background-pages',
  '--use-angle=swiftshader',
  '--use-gl=angle',
];

const BROWSER_CANDIDATES = [
  {
    channel: 'chrome',
    paths: [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ],
  },
  {
    channel: 'msedge',
    paths: [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ],
  },
];

function resolveChannel() {
  const forced = process.env.BROWSER_CHANNEL;
  if (forced) return forced === 'chromium' ? null : forced;
  for (const candidate of BROWSER_CANDIDATES) {
    if (candidate.paths.some((p) => p && fs.existsSync(p))) return candidate.channel;
  }
  return null;
}

function installStealth(config) {
  const locale = (config && config.locale) || 'en-US';
  const baseLanguage = locale.split('-')[0];
  const languages = locale === baseLanguage ? [locale] : [locale, baseLanguage];

  const safe = (fn) => {
    try {
      fn();
    } catch (e) {}
  };

  safe(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
  });

  safe(() => {
    if (!window.chrome) {
      Object.defineProperty(window, 'chrome', {
        value: { runtime: { connect: () => {}, sendMessage: () => {}, id: undefined } },
        writable: true,
        configurable: true,
      });
    } else if (!window.chrome.runtime) {
      Object.defineProperty(window.chrome, 'runtime', {
        value: { connect: () => {}, sendMessage: () => {}, id: undefined },
        writable: true,
        configurable: true,
      });
    }
  });

  safe(() => {
    Object.defineProperty(navigator, 'language', { get: () => locale, configurable: true });
    Object.defineProperty(navigator, 'languages', { get: () => languages.slice(), configurable: true });
  });

  safe(() => {
    if (typeof navigator.plugins === 'object' && navigator.plugins.length === 0) {
      const mimeTypes = [
        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
      ];
      const definitions = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      ];

      const plugins = definitions.map((definition) => {
        const types = mimeTypes.map((mime) => ({
          type: mime.type,
          suffixes: mime.suffixes,
          description: mime.description,
        }));
        return {
          name: definition.name,
          filename: definition.filename,
          description: definition.description,
          length: types.length,
          mimeTypes: types,
          item: (index) => types[index] || null,
          namedItem: (type) => types.find((mime) => mime.type === type) || null,
        };
      });

      const pluginArray = {
        length: plugins.length,
        item: (index) => plugins[index] || null,
        namedItem: (name) => plugins.find((plugin) => plugin.name === name) || null,
        refresh: () => {},
      };
      plugins.forEach((plugin, index) => {
        pluginArray[index] = plugin;
      });

      Object.defineProperty(navigator, 'plugins', { get: () => pluginArray, configurable: true });

      const mimeArray = {
        length: mimeTypes.length,
        item: (index) => mimeTypes[index] || null,
        namedItem: (type) => mimeTypes.find((mime) => mime.type === type) || null,
      };
      mimeTypes.forEach((mime, index) => {
        mimeArray[index] = mime;
      });
      Object.defineProperty(navigator, 'mimeTypes', { get: () => mimeArray, configurable: true });
    }
  });

  safe(() => {
    if (navigator.hardwareConcurrency === undefined) {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
    }
    if (navigator.deviceMemory === undefined) {
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
    }
    if (navigator.pdfViewerEnabled === undefined) {
      Object.defineProperty(navigator, 'pdfViewerEnabled', { get: () => true, configurable: true });
    }
  });

  safe(() => {
    const maskSoftwareRenderer = (proto) => {
      if (!proto || typeof proto.getParameter !== 'function') return;
      if (proto.getParameter.__stealth) return;
      const original = proto.getParameter;
      const patched = function (parameter) {
        const value = original.call(this, parameter);
        if ((parameter === 37445 || parameter === 37446) && typeof value === 'string') {
          if (/swiftshader|llvmpipe|software|basic render|mesa offscreen/i.test(value)) {
            return parameter === 37445
              ? 'Google Inc. (NVIDIA)'
              : 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11-27.21.14.6603)';
          }
        }
        return value;
      };
      patched.__stealth = true;
      proto.getParameter = patched;
    };

    maskSoftwareRenderer(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);
    maskSoftwareRenderer(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);
  });

  safe(() => {
    if (window.__playwright__binding__) delete window.__playwright__binding__;
    if (window.__pwInitScripts) delete window.__pwInitScripts;
    if (window.__playwright_target__) delete window.__playwright_target__;
  });
}


function sanitizeRestoredSession(userDataDir) {
  try {
    const defDir = path.join(userDataDir, 'Default');
    
    fs.rmSync(path.join(defDir, 'Sessions'), { recursive: true, force: true });
    
    const prefPath = path.join(defDir, 'Preferences');
    if (fs.existsSync(prefPath)) {
      const prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
      prefs.profile = prefs.profile || {};
      prefs.profile.exit_type = 'Normal';
      prefs.session = prefs.session || {};
      prefs.session.restore_on_startup = 5; 
      fs.writeFileSync(prefPath, JSON.stringify(prefs));
    }
  } catch (e) {  }
}

async function launchStealthContext(userDataDir, options = {}) {
  sanitizeRestoredSession(userDataDir);
  const channel = options.channel !== undefined ? options.channel : resolveChannel();
  const locale = options.locale || process.env.STEALTH_LOCALE || 'en-US';
  const headless = false; 

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    channel: channel || undefined,
    viewport: options.viewport || null,
    locale,
    acceptDownloads: true,
    chromiumSandbox: true,
    args: STEALTH_ARGS,
    ignoreDefaultArgs: IGNORED_DEFAULT_ARGS,
  });

  await context.addInitScript(installStealth, { locale });

  if (process.env.STEALTH_DEBUG === '1') {
    console.log(`[stealth] channel=${channel || 'playwright-chromium'} locale=${locale} headless=${headless}`);
  }

  return context;
}

module.exports = { launchStealthContext, installStealth, resolveChannel };
