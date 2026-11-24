'use strict';

const CHATGPT_URL = 'https://chatgpt.com/';
const CHATGPT_NEW_CHAT = 'https://chatgpt.com/';
const CHATGPT_LOGIN_URL = 'https://chatgpt.com/auth/login';

// Covers: Codex-style (ProseMirror), classic (#prompt-textarea), lightweight (textarea)
const COMPOSER_SEL = [
  'div.ProseMirror[data-composer-markdown]',
  'form[data-chatgpt-composer] div[contenteditable="true"]',
  '#prompt-textarea',
  'div[contenteditable="true"][data-virtualkeyboard]',
  'textarea[data-mobile-composer-prompt]',
  'form[data-chatgpt-composer] textarea'
].join(', ');

const SEND_SEL = [
  'button[type="submit"][aria-label="Send"]',
  'form[data-chatgpt-composer] button[type="submit"]',
  'button[data-testid="send-button"]',
  'button[data-composer-submit]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send"]',
  'button[aria-label="Send message"]',
  'form[data-chatgpt-composer] button[aria-label*="send" i]',
  'form[data-chatgpt-composer] button.bg-composer-primary',
  'button:has(svg.icon-primary-action)'
].join(', ');

const STOP_SEL = [
  'button[data-testid="stop-button"]',
  'button[data-composer-voice-stop]',
  'button[data-composer-stop]',
  'button[aria-label="Stop streaming"]',
  'button[aria-label="Stop generating"]',
  'button[aria-label="Stop answering"]',
  'form[data-chatgpt-composer] button[aria-label*="stop" i]'
].join(', ');

const CHATGPT_MSG = {
  en: {
    closed: 'ChatGPT session was closed. Please reconnect.',
    notReady: 'ChatGPT is not ready to receive messages yet. If a sign-in window is open, please sign in first.',
    sendFailed: 'Could not send message to ChatGPT. Please start a new chat and try again.',
    cancelled: 'Task was cancelled by user.',
    thinking: 'ChatGPT is thinking and writing...',
    preparing: 'ChatGPT is preparing response...',
    errorPrefix: (e) => `ChatGPT error: ${e}`,
    timeout: 'ChatGPT response timed out before completion. Please re-send your prompt.'
  },
  fa: {
    closed: 'اتصال با \u200FChatGPT\u200F قطع شده است. لطفاً دوباره متصل شوید.',
    notReady: '\u200FChatGPT\u200F هنوز آماده دریافت پیام نیست. اگر پنجره ورود باز است، ابتدا وارد حساب خود شوید.',
    sendFailed: 'ارسال پیام به \u200FChatGPT\u200F انجام نشد. لطفاً یک گفتگوی جدید باز کنید و دوباره تلاش کنید.',
    cancelled: 'عملیات توسط کاربر متوقف شد.',
    thinking: '\u200FChatGPT\u200F در حال فکر کردن و نوشتن است...',
    preparing: '\u200FChatGPT\u200F در حال آماده‌سازی پاسخ است...',
    errorPrefix: (e) => `خطای \u200FChatGPT\u200F: \u200F${e}\u200F`,
    timeout: 'زمان انتظار برای دریافت پاسخ \u200FChatGPT\u200F به پایان رسید. لطفاً پیام خود را دوباره بفرستید.'
  }
};

function injectPromptChatGPT({ selector, content }) {
  const norm = (s) => (s || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').trim();
  const el = document.querySelector(selector);
  if (!el) return { ok: false, via: 'no-input' };
  el.focus();

  const isField = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT';
  const readText = () => (isField ? el.value : (el.innerText || el.textContent || ''));
  const isEmpty = () => norm(readText()) === '';
  const looksComplete = () => {
    const g = norm(readText()), w = norm(content);
    if (g === w) return true;
    const gl = g.split('\n').map(s => s.trim()).filter(Boolean);
    const wl = w.split('\n').map(s => s.trim()).filter(Boolean);
    return gl.length === wl.length && gl[0] === wl[0] && gl[gl.length - 1] === wl[wl.length - 1];
  };

  // ── پاک‌سازی تأییدشده: پیش‌نویس چت قبلی هرگز نباید زنده بماند ──
  if (isField) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, ''); else el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(range);
      document.execCommand('delete', false, null);
    } catch {}
    if (!isEmpty()) {
      try { document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); } catch {}
    }
    if (!isEmpty()) {
      while (el.firstChild) el.removeChild(el.firstChild);
      try { el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' })); } catch {}
    }
  }
  if (!isEmpty()) return { ok: false, via: 'clear-failed' };

  // 1) synthetic paste — ProseMirror / Lexical handle this natively
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', content);
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
    if (looksComplete()) return { ok: true, via: 'paste' };
  } catch {}

  // 2) execCommand line-by-line (contenteditable) or native setter (textarea)
  if (!isField) {
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      const lines = content.split('\n');
      let okm = true;
      for (let i = 0; i < lines.length && okm; i++) {
        if (i > 0) okm = document.execCommand('insertParagraph', false, null);
        if (okm && lines[i].length) okm = document.execCommand('insertText', false, lines[i]);
      }
      if (okm && looksComplete()) return { ok: true, via: 'exec-line' };
    } catch {}
  } else {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(el, content); else el.value = content;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (looksComplete()) return { ok: true, via: 'textarea-native' };
  }

  return { ok: looksComplete(), via: 'fallback' };
}

class ChatGptDriver {
  constructor(page) {
    this.page = page;
    this.isAborted = false;
    this.thinkEnabled = true;
    this._baseline = null;
    this.lang = 'en';
  }

  t(key, ...args) {
    const table = CHATGPT_MSG[this.lang === 'fa' ? 'fa' : 'en'] || CHATGPT_MSG.en;
    const v = table[key];
    return typeof v === 'function' ? v(...args) : v;
  }

  abort() {
    this.isAborted = true;
    this.clickStopButton().catch(() => {});
  }

  async humanClick(target) {
    if (!this.page || this.page.isClosed()) return false;
    try {
      let box = null;
      if (typeof target === 'string') {
        box = await this.page.locator(target).last().boundingBox({ timeout: 2000 }).catch(() => null);
      } else if (target && typeof target.boundingBox === 'function') {
        box = await target.boundingBox({ timeout: 2000 }).catch(() => null);
      }
      if (!box || box.width <= 0 || box.height <= 0) return false;
      const x = box.x + box.width * (0.3 + Math.random() * 0.4);
      const y = box.y + box.height * (0.3 + Math.random() * 0.4);
      await this.page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
      await this.page.waitForTimeout(Math.floor(Math.random() * 60) + 30);
      await this.page.mouse.down();
      await this.page.waitForTimeout(Math.floor(Math.random() * 50) + 40);
      await this.page.mouse.up();
      return true;
    } catch { return false; }
  }

  async setThinkEnabled(enable = true) {
    if (!this.page || this.page.isClosed()) return false;
    const want = Boolean(enable);
    try {
      const candidates = [
        this.page.locator('form[data-chatgpt-composer] button:has-text("Think")').last(),
        this.page.locator('button[aria-label*="think" i]').last(),
        this.page.locator('button[data-testid="thinking-toggle"]').last()
      ];
      let btn = null;
      for (const c of candidates) {
        if (await c.isVisible({ timeout: 600 }).catch(() => false)) { btn = c; break; }
      }
      if (!btn) { this.thinkEnabled = want; return false; }
      const readState = async () => {
        const pressed = await btn.getAttribute('aria-pressed').catch(() => null);
        if (pressed === 'true') return true;
        if (pressed === 'false') return false;
        const cls = (await btn.getAttribute('class').catch(() => '')) || '';
        if (/active|selected|pressed/i.test(cls)) return true;
        return null;
      };
      let cur = await readState();
      if (cur === want) { this.thinkEnabled = want; return true; }
      await this.humanClick(btn);
      await this.page.waitForTimeout(450);
      const menuOpen = await this.page.locator('[role="menu"]').first().isVisible({ timeout: 300 }).catch(() => false);
      if (menuOpen) {
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(250);
      }
      cur = await readState();
      if (cur === null || cur === want) { this.thinkEnabled = want; return true; }
      await this.humanClick(btn);
      await this.page.waitForTimeout(400);
      await this.page.keyboard.press('Escape').catch(() => {});
      this.thinkEnabled = want;
      return true;
    } catch {
      await this.page.keyboard.press('Escape').catch(() => {});
      return false;
    }
  }

  async setThinkingLevel(level) {
    return this.setThinkEnabled(!/^(off|low|instant|standard|fast|minimal)$/i.test(String(level || '')));
  }

  async setDeepThink(enable = true) {
    return this.setThinkEnabled(Boolean(enable));
  }

  async findInputElement() {
    for (const sel of COMPOSER_SEL.split(', ')) {
      const loc = this.page.locator(sel);
      const n = await loc.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const item = loc.nth(i);
        if (await item.isVisible({ timeout: 500 }).catch(() => false)) return item;
      }
    }
    return null;
  }

  async readComposerText() {
    if (!this.page || this.page.isClosed()) return '';
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return '';
      const isField = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT';
      const txt = isField ? el.value : (el.innerText || el.textContent || '');
      return String(txt || '').replace(/\u00a0/g, ' ').trim();
    }, COMPOSER_SEL).catch(() => '');
  }

  async _sweepStoredDrafts() {
    if (!this.page || this.page.isClosed()) return;
    await this.page.evaluate(() => {
      try {
        const doomed = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && /draft/i.test(k)) doomed.push(k);
        }
        doomed.forEach(k => localStorage.removeItem(k));
      } catch {}
    }).catch(() => {});
  }

  // ★ پاک‌سازی کامل پیش‌نویس با تأیید خالی‌شدن (ضد بازگشت draft توسط هیدریشن React)
  async clearComposer({ attempts = 3, settleMs = 300, waitMs = 8000 } = {}) {
    if (!this.page || this.page.isClosed()) return false;

    let input = await this.findInputElement();
    if (!input) {
      await this.page.waitForSelector(COMPOSER_SEL, { timeout: waitMs }).catch(() => {});
      input = await this.findInputElement();
      if (!input) return false;
    }

    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (!(await this.readComposerText())) {
        await this._sweepStoredDrafts();
        await this.page.waitForTimeout(attempt === 1 ? 600 : settleMs);
        if (!(await this.readComposerText())) return true;
        continue; // draft بعد از هیدریشن برگشت — دوباره پاک کن
      }

      await input.focus().catch(() => {});
      await this.page.waitForTimeout(80);

      await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const isField = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT';
        const fire = () => {
          try { el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' })); } catch {}
          try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
        };
        el.focus();
        if (isField) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
            || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(el, ''); else el.value = '';
          fire();
          return;
        }
        try {
          const range = document.createRange();
          range.selectNodeContents(el);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(range);
          document.execCommand('delete', false, null);
        } catch {}
        if ((el.textContent || '').trim() !== '') {
          try { document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); } catch {}
        }
        if ((el.textContent || '').trim() !== '') {
          while (el.firstChild) el.removeChild(el.firstChild);
        }
        fire();
      }, COMPOSER_SEL).catch(() => {});

      // fallback با رویداد واقعی کیبورد (trusted)
      if (await this.readComposerText()) {
        await this.page.keyboard.press('Control+A').catch(() => {});
        await this.page.keyboard.press('Delete').catch(() => {});
      }

      await this.page.waitForTimeout(settleMs);
      await this._sweepStoredDrafts();
      if (!(await this.readComposerText())) return true;
    }
    return !(await this.readComposerText());
  }

  async clickStopButton() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      return await this.page.evaluate((sel) => {
        const b = document.querySelector(sel);
        if (b && !b.disabled) { b.click(); return true; }
        return false;
      }, STOP_SEL);
    } catch { return false; }
  }

  async clickContinueButton() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      const loc = this.page.locator('button:has-text("Continue generating"), div[role="button"]:has-text("Continue generating")').last();
      if (await loc.isVisible({ timeout: 500 }).catch(() => false)) return await this.humanClick(loc);
    } catch {}
    return false;
  }

  async clickSendButton() {
    if (!this.page || this.page.isClosed()) return false;
    const domClicked = await this.page.evaluate(({ compSel, sendSel }) => {
      const norm = (s) => (s || '').replace(/\u00a0/g, ' ').trim();
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (!r || r.width < 4 || r.height < 4) return false;
        const st = window.getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
        if (el.closest('[inert]')) return false;
        return true;
      };
      const isSend = (b) => {
        const label = (b.getAttribute('aria-label') || '').toLowerCase();
        if (/voice|dictate|microphone|record/.test(label)) return false;
        if (b.hasAttribute('data-composer-voice-start') || b.hasAttribute('data-dictation-button')) return false;
        if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
        return true;
      };
      const score = (x) =>
        (x.type === 'submit' ? 4 : 0) +
        (/^send/.test((x.getAttribute('aria-label') || '').toLowerCase()) ? 2 : 0) +
        ((x.querySelector('svg.icon-primary-action') || /bg-composer-primary/.test(x.className || '')) ? 1 : 0);
      const scopes = [];
      const editors = Array.from(document.querySelectorAll(compSel))
        .filter(el => norm(el.value || el.innerText || el.textContent || '').length > 0);
      for (const ed of editors) {
        const form = ed.closest('form[data-chatgpt-composer]') || ed.closest('form');
        if (form && !scopes.includes(form)) scopes.push(form);
      }
      for (const f of Array.from(document.querySelectorAll('form[data-chatgpt-composer]'))) {
        if (!scopes.includes(f)) scopes.push(f);
      }
      scopes.push(document);
      for (const scope of scopes) {
        const btns = Array.from(scope.querySelectorAll(sendSel)).filter(b => isSend(b) && isVisible(b));
        btns.sort((a, b) => score(b) - score(a));
        const b = btns[0];
        if (b) {
          try { b.scrollIntoView({ block: 'center', inline: 'center' }); } catch {}
          b.click();
          return true;
        }
      }
      return false;
    }, { compSel: COMPOSER_SEL, sendSel: SEND_SEL }).catch(() => false);
    if (domClicked) return true;

    const candidates = [
      'form[data-chatgpt-composer] button[type="submit"][aria-label="Send"]',
      'form[data-chatgpt-composer] button[type="submit"]',
      'button[data-testid="send-button"]',
      'form[data-chatgpt-composer] button[aria-label="Send"]',
      'form[data-chatgpt-composer] button.bg-composer-primary',
      'form[data-chatgpt-composer] button:has(svg.icon-primary-action)'
    ];
    for (const sel of candidates) {
      const loc = this.page.locator(sel).last();
      if (await loc.isVisible({ timeout: 400 }).catch(() => false)) {
        try {
          await loc.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
          await loc.click({ timeout: 1500, force: true });
          return true;
        } catch {}
      }
    }

    const submitted = await this.page.evaluate((compSel) => {
      const norm = (s) => (s || '').trim();
      const editors = Array.from(document.querySelectorAll(compSel))
        .filter(el => norm(el.value || el.innerText || el.textContent || '').length > 0);
      for (const ed of editors) {
        const form = ed.closest('form');
        if (form && typeof form.requestSubmit === 'function') {
          try {
            const btn = form.querySelector('button[type="submit"]:not([disabled])');
            form.requestSubmit(btn || undefined);
            return true;
          } catch {}
        }
      }
      return false;
    }, COMPOSER_SEL).catch(() => false);
    return submitted;
  }

  async uploadFiles(filePaths = []) {
    if (!this.page || this.page.isClosed() || !filePaths.length) return;
    try {
      const input = this.page.locator('input[aria-label="Attach files"], input[type="file"][multiple]').last();
      if (await input.count() > 0) {
        console.log(`📤 Uploading ${filePaths.length} file(s) to ChatGPT...`);
        await input.setInputFiles(filePaths);
        const names = filePaths.map(p => require('node:path').basename(p));
        const deadline = Date.now() + Math.min(120000, 15000 + filePaths.length * 30000);
        while (Date.now() < deadline) {
          const ok = await this.page.evaluate((ns) => {
            const body = document.body ? document.body.innerText : '';
            return ns.every(n => body.includes(n));
          }, names).catch(() => false);
          if (ok) break;
          await this.page.waitForTimeout(700);
        }
        await this.page.waitForTimeout(600);
      }
    } catch (err) {
      console.warn('⚠️ ChatGPT upload warning:', err.message);
    }
  }

  async clearStagedMedia(names = null) {
    if (!this.page || this.page.isClosed()) return;
    try {
      for (let i = 0; i < 20; i++) {
        const removed = await this.page.evaluate((wantNames) => {
          const btns = Array.from(document.querySelectorAll('button[aria-label], button[data-testid]'));
          const isRemove = (b) => /remove|delete|حذف/i.test(
            (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('data-testid') || '')
          );
          if (!wantNames) {
            const b = btns.find(x => isRemove(x) && /file|attach/i.test(x.getAttribute('aria-label') || ''));
            if (b) { b.click(); return true; }
            return false;
          }
          for (const n of wantNames) {
            const el = Array.from(document.querySelectorAll('div,span')).find(e =>
              e.children.length === 0 && (e.textContent || '').trim() === n
            );
            if (!el) continue;
            let scope = el;
            for (let up = 0; up < 6 && scope; up++) {
              const b = Array.from(scope.querySelectorAll('button')).find(isRemove);
              if (b) { b.click(); return true; }
              scope = scope.parentElement;
            }
          }
          return false;
        }, names).catch(() => false);
        if (!removed) break;
        await this.page.waitForTimeout(300);
      }
    } catch (e) { console.warn('ChatGPT clearStagedMedia warning:', e.message); }
  }

  async sendMessage(text, options = {}) {
    if (options.lang) this.lang = options.lang === 'fa' ? 'fa' : 'en';
    if (!this.page || this.page.isClosed()) throw new Error(this.t('closed'));
    if (!/chatgpt\.com/.test(this.page.url())) {
      await this.page.goto(CHATGPT_NEW_CHAT, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await this.page.waitForTimeout(1200);
    }

    const auth = await this.getAuthState();
    if (auth.status === 'login_page') {
      const e = new Error('CHATGPT_LOGIN_REQUIRED'); e.code = 'CHATGPT_LOGIN_REQUIRED'; throw e;
    }
    if (auth.status === 'captcha') {
      const e = new Error('CAPTCHA_REQUIRED'); e.code = 'CAPTCHA_REQUIRED'; throw e;
    }

    // Baseline قبل از ارسال ثبت می‌شود، نه بعد از آن.
    const pre = await this.extractLiveState();
    this._baseline = {
      ids: (pre && pre.turnIds) || [],
      lastText: (pre && pre.bodyText) || '',
      count: (pre && pre.turnCount) || 0
    };

    const wantThink = typeof options.chatgptThink === 'boolean' ? options.chatgptThink : this.thinkEnabled;
    await this.setThinkEnabled(wantThink);

    // ★ پیش‌نویس باقی‌مانده از چت/تسک قبلی — قبل از تزریق کاملاً پاک شود
    await this.clearComposer();

    const input = await this.findInputElement();
    if (!input) throw new Error(this.t('notReady'));
    await input.focus();
    await this.page.waitForTimeout(150);

    const full = String(text);
    let result = await this.page.evaluate(injectPromptChatGPT, { selector: COMPOSER_SEL, content: full });

    if (!result || !result.ok) {
      await this.clearComposer();
      const CHUNK = 4000;
      for (let i = 0; i < full.length; i += CHUNK) {
        await this.page.keyboard.insertText(full.slice(i, i + CHUNK));
        if (i + CHUNK < full.length) await this.page.waitForTimeout(20);
      }
      result = await this.page.evaluate(injectPromptChatGPT, { selector: COMPOSER_SEL, content: full });
    }

    if (!result || !result.ok) {
      throw new Error(this.t('sendFailed'));
    }
    console.log(`✅ ChatGPT injection OK (method: ${result.via})`);

    await this.page.waitForTimeout(350);

    const isSent = () => this.page.evaluate(({ compSel, stopSel }) => {
      const stop = document.querySelector(stopSel);
      const comps = Array.from(document.querySelectorAll(compSel));
      const allEmpty = comps.length === 0 ||
        comps.every(c => (c.value || c.innerText || c.textContent || '').trim() === '');
      return !!stop || allEmpty;
    }, { compSel: COMPOSER_SEL, stopSel: STOP_SEL }).catch(() => false);

    let sent = false;
    for (let attempt = 1; attempt <= 3 && !sent; attempt++) {
      const clicked = await this.clickSendButton();
      if (!clicked) {
        await input.focus().catch(() => {});
        await this.page.keyboard.press('Enter');
      }
      await this.page.waitForTimeout(800);
      sent = await isSent();
      if (!sent) {
        await input.focus().catch(() => {});
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(700);
        sent = await isSent();
      }
      if (!sent) console.warn(`⚠️ ChatGPT send attempt ${attempt} not confirmed — retrying...`);
    }

    if (!sent) {
      throw new Error(this.t('sendFailed'));
    }
  }

  async extractLiveState() {
    if (!this.page || this.page.isClosed()) return null;
    try {
      return await this.page.evaluate(({ compSel, stopSel }) => {
        const visible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          if (!r || r.width < 2 || r.height < 2) return false;
          const st = window.getComputedStyle(el);
          return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
        };
        const norm = (s) => (s || '').replace(/\u00a0/g, ' ').trim();
        const url = location.href;

        const composer = document.querySelector(compSel);
        const composerReady = !!composer && visible(composer) && !composer.hasAttribute('disabled');

        const onAuthHost = /(^|\.)auth\.openai\.com$/.test(location.hostname) || location.hostname === 'accounts.google.com';
        const loginModal = document.querySelector('#mobile-auth-dialog[open]');
        const loginBtn = document.querySelector('button[data-login-button], a[href*="/auth/login"]');
        const needsLogin = onAuthHost || !!loginModal || /\/auth\/(login|login_with)/.test(location.pathname) || (!composerReady && !!loginBtn);

        const cfTitle = /just a moment|attention required|verify you are human/i.test(document.title);
        const cfStage = document.querySelector('#challenge-stage, #turnstile-wrapper, iframe[src*="challenges.cloudflare.com"]');
        const bodyHead = (document.body ? document.body.innerText : '').slice(0, 1500);
        const captcha = !composerReady && (cfTitle || (cfStage && visible(cfStage)) || /verify you are human|checking your browser/i.test(bodyHead));

        const stopEl = document.querySelector(stopSel);
        const stopVisible = !!stopEl && visible(stopEl);
        const streamingEl = document.querySelector('.result-streaming, [data-dil-streaming="true"], [data-testid="conversation-turn-streaming"], [data-is-streaming="true"]');
        const thinkLeaf = Array.from(document.querySelectorAll('span, div, p'))
          .filter(el => el.children.length === 0 && visible(el))
          .reverse()
          .find(el => /^(Thinking|Reasoning|Generating)(…|\.{3})?$/i.test((el.textContent || '').trim()));
        const thinkingVisible = !!streamingEl || !!thinkLeaf;

        let turnEls = Array.from(document.querySelectorAll('[data-response-body]')).filter(visible);
        let idAttr = 'data-response-body';
        if (!turnEls.length) {
          turnEls = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]')).filter(visible);
          idAttr = 'data-message-id';
        }
        if (!turnEls.length) {
          turnEls = Array.from(document.querySelectorAll('[data-dil-response]')).filter(visible);
          idAttr = 'data-dil-message-id';
        }
        const idOf = (el) => {
          const direct = el.getAttribute(idAttr);
          if (direct) return direct;
          const dil = el.querySelector('[data-dil-message-id]');
          if (dil) return dil.getAttribute('data-dil-message-id') || '';
          const sel = el.querySelector('[data-chatgpt-selection-message-id]');
          if (sel) return sel.getAttribute('data-chatgpt-selection-message-id') || '';
          return '';
        };
        const turnIds = turnEls.map(idOf);
        const lastEl = turnEls.length ? turnEls[turnEls.length - 1] : null;
        const lastTurnId = lastEl ? idOf(lastEl) : '';

        let bodyText = '';
        if (lastEl) {
          const codes = Array.from(lastEl.querySelectorAll('[data-chatgpt-copy-code]'))
            .map(n => n.getAttribute('data-chatgpt-copy-code') || '')
            .filter(c => c.trim().length > 0);
          if (codes.length) {
            bodyText = codes.map(c => {
              const t = c.trim();
              const lang = /^[{[]/.test(t) ? 'json' : '';
              return '```' + lang + '\n' + t + '\n```';
            }).join('\n');
          } else {
            const clone = lastEl.cloneNode(true);
            clone.querySelectorAll('button, [data-markdown-copy="exclude"], [class*="actionRow"], [class*="turn-action"], [data-code-block-controls]').forEach(n => n.remove());
            bodyText = norm(clone.innerText || clone.textContent || '');
          }
        }

        let finishedMarker = false;
        if (lastEl) {
          const scope = lastEl.closest('[data-turn-key]') || lastEl.parentElement || lastEl;
          finishedMarker = !!scope.querySelector(
            'button[aria-label="Rate response"], button[aria-label="Read aloud"], [data-testid="copy-turn-action-button"], button[aria-label="More actions"], button[aria-label="Good response"], button[aria-label="Bad response"]'
          );
        }
        const responseComplete = Array.from(document.querySelectorAll('[role="status"]'))
          .some(el => /response complete/i.test(el.textContent || ''));

        const RATE_RE = /you(?:'ve| have) reached|usage limit|rate limit|too many requests|out of (?:free )?messages|limit reached|try again later|upgrade to (?:plus|pro)|get plus to|you(?:'re| are) out of/i;
        const bannerEls = Array.from(document.querySelectorAll('[role="alert"], [data-testid*="rate-limit"], [class*="rate-limit"], [class*="usage-limit"], [class*="error-banner"], [data-testid="conversation-error"]'))
          .filter(el => visible(el) && (!el.closest('pre, code, [data-response-body]') || el.matches('[data-testid="conversation-error"], [data-testid*="rate-limit"]')));
        const bannerText = bannerEls.map(el => norm(el.innerText || '')).join('\n');
        const rateLimit = RATE_RE.test(bannerText);
        const errorText = /error|wrong|failed|unable|couldn't/i.test(bannerText) ? bannerText.slice(0, 400) : '';

        const notFound = !composerReady && /conversation not found|this conversation may have been deleted|doesn't exist|page not found/i.test(bodyHead);

        return {
          bodyText, turnIds, turnCount: turnEls.length, lastTurnId,
          stopVisible, thinkingVisible, finishedMarker, responseComplete,
          rateLimit, errorText, needsLogin, captcha, notFound, composerReady, url
        };
      }, { compSel: COMPOSER_SEL, stopSel: STOP_SEL });
    } catch { return null; }
  }

  async getAuthState() {
    if (!this.page || this.page.isClosed()) return { status: 'closed', url: '' };
    const url = this.page.url();
    if (/auth\.openai\.com|accounts\.google\.com|\/auth\/login/.test(url)) return { status: 'login_page', url };
    const st = await this.extractLiveState();
    if (!st) return { status: 'loading', url };
    if (st.captcha) return { status: 'captcha', url };
    if (st.needsLogin) return { status: 'login_page', url };
    if (!st.composerReady) return { status: 'no_input', url };
    return { status: 'ready', url };
  }

  async waitForCompletion(onProgress, onStatus = null) {
    this.isAborted = false;
    const baseline = this._baseline || { ids: [], lastText: '', count: 0 };
    const baseIds = new Set(baseline.ids || []);
    let lastLen = -1, stable = 0, loops = 0, emptyNew = 0;
    let sawRunning = false, sawNewTurn = false, lastEmitted = '';

    while (true) {
      if (this.isAborted) throw new Error(this.t('cancelled'));
      if (!this.page || this.page.isClosed()) throw new Error(this.t('closed'));
      await this.page.waitForTimeout(700);
      if (this.isAborted) throw new Error(this.t('cancelled'));
      loops++;

      const state = await this.extractLiveState();
      if (!state) continue;

      if (state.captcha) { const e = new Error('CAPTCHA_REQUIRED'); e.code = 'CAPTCHA_REQUIRED'; throw e; }
      if (state.needsLogin) { const e = new Error('CHATGPT_LOGIN_REQUIRED'); e.code = 'CHATGPT_LOGIN_REQUIRED'; throw e; }
      if (state.rateLimit) { const e = new Error('CHATGPT_RATE_LIMIT'); e.code = 'CHATGPT_RATE_LIMIT'; throw e; }

      const running = state.stopVisible || state.thinkingVisible;
      if (running) sawRunning = true;

      let isNewTurn = false;
      if (state.lastTurnId) {
        isNewTurn = !baseIds.has(state.lastTurnId);
      } else {
        isNewTurn = state.turnCount > (baseline.count || 0) ||
          (!!state.bodyText && state.bodyText !== (baseline.lastText || ''));
      }
      if (isNewTurn && (state.bodyText || '').length > 0) sawNewTurn = true;

      if (running) {
        stable = 0;
        lastLen = (state.bodyText || '').length;
        if (isNewTurn && state.bodyText && state.bodyText !== lastEmitted && typeof onProgress === 'function') {
          onProgress({ text: state.bodyText });
          lastEmitted = state.bodyText;
        }
        if (typeof onStatus === 'function') onStatus(this.t('thinking'));
        continue;
      }

      if (!sawNewTurn) {
        const cont = await this.clickContinueButton();
        if (cont) { sawRunning = true; stable = 0; await this.page.waitForTimeout(1000); continue; }
        if (loops > 110 && !sawRunning) {
          const e = new Error('NO_NEW_RESPONSE: ChatGPT never started a new reply.');
          e.code = 'NO_NEW_RESPONSE'; throw e;
        }
        if (loops > 300) {
          const e = new Error('NO_NEW_RESPONSE: ChatGPT response could not be located.');
          e.code = 'NO_NEW_RESPONSE'; throw e;
        }
        if (typeof onStatus === 'function') onStatus(this.t('preparing'));
        continue;
      }

      const text = state.bodyText || '';
      if (text.length > 5) {
        emptyNew = 0;
        if (text.length === lastLen) stable++;
        else {
          lastLen = text.length;
          stable = 0;
          if (typeof onProgress === 'function' && text !== lastEmitted) {
            onProgress({ text });
            lastEmitted = text;
          }
        }
        const need = (state.finishedMarker || state.responseComplete) ? 1 : 3;
        if (stable >= need) {
          await this.page.waitForTimeout(450);
          const verify = await this.extractLiveState();
          if (verify && !verify.stopVisible && !verify.thinkingVisible &&
              (verify.bodyText || '') === text &&
              (!state.lastTurnId || verify.lastTurnId === state.lastTurnId)) {
            console.log('✅ ChatGPT response finished and verified (pre-send baseline).');
            return text;
          }
          if (verify && (verify.stopVisible || verify.thinkingVisible)) sawRunning = true;
          stable = 0;
          continue;
        }
      } else {
        emptyNew++;
        stable = 0;
        if (emptyNew > 40) {
          if (state.errorText) throw new Error(this.t('errorPrefix', state.errorText));
          const e = new Error('NO_NEW_RESPONSE: ChatGPT started a reply but no content was captured.');
          e.code = 'NO_NEW_RESPONSE'; throw e;
        }
      }

      if (loops > 420) {
        if (text.length > 5) return text;
        throw new Error(this.t('timeout'));
      }
    }
  }

  async startNewChat() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      await this.page.goto(CHATGPT_NEW_CHAT, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await this.page.waitForTimeout(1200);
      this._baseline = null;

      const auth = await this.getAuthState();
      if (auth.status === 'login_page' || auth.status === 'captcha') return true;

      // ★ ChatGPT پیش‌نویس ارسال‌نشدهٔ چت قبلی را برمی‌گرداند — کامل پاکش کن
      await this.clearComposer();
      // پاس دوم برای هیدریشن دیرهنگام React که ممکن است draft را برگرداند
      await this.page.waitForTimeout(900);
      await this.clearComposer({ waitMs: 2000 });
      return true;
    } catch (e) {
      console.warn('ChatGPT startNewChat warning:', e.message);
      return false;
    }
  }

  async getChatUrl() {
    if (!this.page || this.page.isClosed()) return null;
    return this.page.url();
  }

  async parkTab() {
    if (!this.page || this.page.isClosed()) return;
    try {
      // ★ قبل از پارک، پیش‌نویس ارسال‌نشده پاک شود تا ChatGPT اصلاً آن را ذخیره نکند
      await this.clearComposer({ attempts: 2, waitMs: 1500, settleMs: 150 }).catch(() => {});
      await this.page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 8000 });
    } catch (e) { console.warn('parkTab warning:', e.message); }
  }

  async checkChatExists(targetUrl) {
    if (!this.page || this.page.isClosed()) return true;
    if (!targetUrl || !targetUrl.includes('chatgpt.com/c/')) return false;
    try {
      if (this.page.url() !== targetUrl) {
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await this.page.waitForTimeout(1500);
      }
      const url = this.page.url();
      if (!url.includes('/c/')) return false;
      return await this.page.evaluate((compSel) => {
        const head = (document.body ? document.body.innerText : '').slice(0, 1200);
        if (/conversation not found|may have been deleted|doesn't exist|page not found/i.test(head)) return false;
        return !!document.querySelector(compSel);
      }, COMPOSER_SEL);
    } catch { return true; }
  }
}

module.exports = ChatGptDriver;
module.exports.CHATGPT_URL = CHATGPT_URL;
module.exports.CHATGPT_NEW_CHAT = CHATGPT_NEW_CHAT;
module.exports.CHATGPT_LOGIN_URL = CHATGPT_LOGIN_URL;