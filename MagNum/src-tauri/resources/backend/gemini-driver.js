'use strict';





const AI_STUDIO_MODEL = process.env.MAGNUM_GEMINI_MODEL || 'gemini-3.8-flash';
const AI_STUDIO_NEW_CHAT = `https://aistudio.google.com/prompts/new_chat?model=${AI_STUDIO_MODEL}`;

const MAGNUM_THINKING_LEVEL = process.env.MAGNUM_THINKING_LEVEL || 'medium';

const GEMINI_MSG = {
  en: {
    closed: 'Gemini session was closed. Please reconnect.',
    notReady: 'Gemini is not ready to receive messages yet. If a Google sign-in window is open, please sign in first.',
    sendFailed: 'Could not send message to Gemini. Please start a new chat and try again.',
    cancelled: 'Task was cancelled by user.',
    thinking: 'Gemini is thinking and writing...',
    preparing: 'Gemini is preparing response...',
    errorPrefix: (e) => `Gemini error: ${e}`,
    timeout: 'Gemini response timed out before completion. Please re-send your prompt.',
    mediaRejected: 'Gemini rejected the attached file.'
  },
  fa: {
    closed: 'اتصال با \u200FGemini\u200F قطع شده است. لطفاً دوباره متصل شوید.',
    notReady: '\u200FGemini\u200F هنوز آماده دریافت پیام نیست. اگر پنجره ورود گوگل باز است، ابتدا وارد حساب خود شوید.',
    sendFailed: 'ارسال پیام به \u200FGemini\u200F انجام نشد. لطفاً یک گفتگوی جدید باز کنید و دوباره تلاش کنید.',
    cancelled: 'عملیات توسط کاربر متوقف شد.',
    thinking: '\u200FGemini\u200F در حال فکر کردن و نوشتن است...',
    preparing: '\u200FGemini\u200F در حال آماده‌سازی پاسخ است...',
    errorPrefix: (e) => `خطای \u200FGemini\u200F: \u200F${e}\u200F`,
    timeout: 'زمان انتظار برای دریافت پاسخ \u200FGemini\u200F به پایان رسید. لطفاً پیام خود را دوباره بفرستید.',
    mediaRejected: 'فایل پیوست‌شده توسط \u200FGemini\u200F پذیرفته نشد.'
  }
};


async function injectPromptAIStudio(content) {
  const norm = (s) => (s || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').trim();
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = document.querySelector('textarea[placeholder*="Start typing"]') ||
    document.querySelector('ms-prompt-textarea textarea') ||
    document.querySelector('textarea[aria-label*="prompt" i]') ||
    document.querySelector('div[contenteditable="true"][role="textbox"]') ||
    document.querySelector('div[contenteditable="true"]') ||
    document.querySelector('textarea');
  if (!el) return { ok: false, via: 'no-input' };
  el.focus();
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ||
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, content); else el.value = content;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(150);
    return { ok: norm(el.value) === norm(content), via: 'textarea-native' };
  }
  
  const clearEditor = () => {
    try { document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); } catch (e) {}
    if ((el.textContent || '').trim() !== '') {
      while (el.firstChild) el.removeChild(el.firstChild);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
  };
  const readText = () => (el.innerText || el.textContent || '');
  const looksComplete = () => {
    const g = norm(readText()); const w = norm(content);
    if (g === w) return true;
    const gl = g.split('\n').map(s => s.trim()).filter(Boolean);
    const wl = w.split('\n').map(s => s.trim()).filter(Boolean);
    return gl.length === wl.length && gl[0] === wl[0] && gl[gl.length - 1] === wl[wl.length - 1];
  };
  clearEditor();
  let okm = true;
  const lines = content.split('\n');
  try {
    for (let i = 0; i < lines.length && okm; i++) {
      if (i > 0) okm = document.execCommand('insertParagraph', false, null);
      if (okm && lines[i].length) okm = document.execCommand('insertText', false, lines[i]);
    }
  } catch (e) { okm = false; }
  if (okm) { await settle(120); if (looksComplete()) return { ok: true, via: 'exec-line' }; }
  clearEditor();
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', content);
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
    await settle(300);
    if (looksComplete()) return { ok: true, via: 'paste' };
  } catch (e) {}
  return { ok: looksComplete(), via: 'fallback' };
}

class GeminiDriver {
  constructor(page) {
    this.page = page;
    this.isAborted = false;
    this.thinkingLevel = MAGNUM_THINKING_LEVEL;
    this._baseline = null;
    this.lang = 'en';
  }
  t(key, ...args) {
    const table = GEMINI_MSG[this.lang === 'fa' ? 'fa' : 'en'] || GEMINI_MSG.en;
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
      const clickX = box.x + box.width * (0.3 + Math.random() * 0.4);
      const clickY = box.y + box.height * (0.3 + Math.random() * 0.4);
      await this.page.mouse.move(clickX, clickY, { steps: Math.floor(Math.random() * 5) + 3 });
      await this.page.waitForTimeout(Math.floor(Math.random() * 60) + 30);
      await this.page.mouse.down();
      await this.page.waitForTimeout(Math.floor(Math.random() * 50) + 40);
      await this.page.mouse.up();
      return true;
    } catch {
      return false;
    }
  }
  
  async setThinkingLevel(level = MAGNUM_THINKING_LEVEL) {
    if (!this.page || this.page.isClosed()) return false;
    const wanted = String(level).toLowerCase();
    try {
      for (let attempt = 1; attempt <= 2; attempt++) {
        
        const idx = await this.page.evaluate(() => {
          const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
          const selects = Array.from(document.querySelectorAll('mat-select'));
          let i = selects.findIndex(s => (s.getAttribute('aria-label') || '').toLowerCase().includes('thinking'));
          if (i === -1) i = selects.findIndex(s => ['low', 'medium', 'high'].includes(norm(s.textContent)));
          return i;
        });
        if (idx === -1) return false;
        const current = await this.page.evaluate((i) => {
          const s = document.querySelectorAll('mat-select')[i];
          return s ? (s.textContent || '').trim().toLowerCase() : '';
        }, idx);
        if (current === wanted) return true; 
        await this.humanClick(`mat-select >> nth=${idx}`);
        await this.page.waitForTimeout(450);
        
        const option = this.page.getByRole('option', { name: new RegExp(`^${wanted}$`, 'i') }).last();
        if (await option.isVisible({ timeout: 1500 }).catch(() => false)) {
          await this.humanClick(option);
          await this.page.waitForTimeout(400);
        } else {
          await this.page.keyboard.press('Escape').catch(() => {});
          return false;
        }
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(200);
        const after = await this.page.evaluate((i) => {
          const s = document.querySelectorAll('mat-select')[i];
          return s ? (s.textContent || '').trim().toLowerCase() : '';
        }, idx);
        if (after === wanted) {
          console.log(`✅ AI Studio Thinking level set to ${wanted}.`);
          this.thinkingLevel = wanted;
          return true;
        }
      }
      return false;
    } catch (e) {
      console.warn('⚠️ Could not set AI Studio Thinking Level:', e.message);
      await this.page.keyboard.press('Escape').catch(() => {});
      return false;
    }
  }
  async setDeepThink(enable = true) {
    await this.setThinkingLevel(enable ? 'high' : (this.thinkingLevel || MAGNUM_THINKING_LEVEL));
  }

  
  
  
  async ensureModel(wantedId = AI_STUDIO_MODEL) {
    if (!this.page || this.page.isClosed()) return false;
    const wanted = String(wantedId || AI_STUDIO_MODEL).trim().toLowerCase();
    const readCurrent = () => this.page.evaluate(() => {
      const card = document.querySelector('button.model-selector-card, ms-model-selector .model-selector-card, ms-model-selector button');
      if (!card) return null;
      const sub = card.querySelector('[data-test-id="model-name"], .subtitle');
      const title = card.querySelector('.title');
      return {
        id: ((sub && sub.textContent) || '').trim().toLowerCase(),
        title: ((title && title.textContent) || '').trim().toLowerCase()
      };
    });
    const isWanted = (cur) => Boolean(cur) && (
      cur.id === wanted ||
      (cur.id && cur.id.includes(wanted)) ||
      (cur.title && cur.title.includes(wanted))
    );
    
    const ROW_SEL = 'ms-model-carousel-row, [class*="carousel-row"], [class*="model-card"], [class*="model-row"]';
    try {
      for (let attempt = 1; attempt <= 2; attempt++) {
        let cur = await readCurrent();
        if (cur === null) {
          const opened = await this.page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button[aria-label]'))
              .find(b => /run settings|open settings|settings panel/i.test(b.getAttribute('aria-label') || ''));
            if (btn) { btn.click(); return true; }
            return false;
          });
          if (!opened) return false; 
          await this.page.waitForTimeout(800);
          cur = await readCurrent();
          if (cur === null) return false;
        }
        if (isWanted(cur)) return true; 
        
        await this.page.evaluate(() => {
          const card = document.querySelector('button.model-selector-card, ms-model-selector .model-selector-card, ms-model-selector button');
          if (card) card.click();
        });
        await this.page.waitForTimeout(900);
        
        const searchSel = 'mat-mdc-dialog-container input, mat-dialog-container input';
        if (await this.page.locator(searchSel).first().isVisible({ timeout: 1200 }).catch(() => false)) {
          await this.page.evaluate(({ sel, val }) => {
            const el = document.querySelector(sel);
            if (!el) return;
            el.focus();
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(el, val); else el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }, { sel: searchSel, val: wanted });
          await this.page.waitForTimeout(1000);
        }
        
        let clicked = false;
        const rowsLoc = this.page.locator(`mat-mdc-dialog-container ${ROW_SEL}, mat-dialog-container ${ROW_SEL}`);
        const n = await rowsLoc.count().catch(() => 0);
        let targetIdx = -1;
        for (let i = 0; i < n && targetIdx === -1; i++) {
          const txt = ((await rowsLoc.nth(i).textContent().catch(() => '')) || '').toLowerCase().replace(/\s+/g, ' ');
          if (txt.includes(wanted) && !txt.includes(wanted + '-tts') && !txt.includes(wanted + ' tts')) targetIdx = i;
        }
        if (targetIdx === -1) {
          for (let i = 0; i < n && targetIdx === -1; i++) {
            const txt = ((await rowsLoc.nth(i).textContent().catch(() => '')) || '').toLowerCase();
            if (txt.includes(wanted)) targetIdx = i;
          }
        }
        if (targetIdx >= 0) {
          clicked = await this.humanClick(rowsLoc.nth(targetIdx));
          if (!clicked) {
            await rowsLoc.nth(targetIdx).click({ timeout: 2000, force: true }).catch(() => {});
            clicked = true;
          }
        }
        if (!clicked) {
          
          clicked = Boolean(await this.page.evaluate(({ w, rowSel }) => {
            const dlg = document.querySelector('mat-mdc-dialog-container, mat-dialog-container') || document;
            const norm = (s) => (s || '').trim().toLowerCase();
            const candidates = Array.from(dlg.querySelectorAll(rowSel));
            const meta = (el) => ({
              sub: norm((el.querySelector('.model-subtitle, [class*="subtitle"]') || {}).textContent),
              title: norm((el.querySelector('.model-title-text, [class*="title"]') || {}).textContent)
            });
            let row = candidates.find(el => meta(el).sub === w);
            if (!row) row = candidates.find(el => meta(el).sub.includes(w) && !meta(el).sub.includes(w + '-tts'));
            if (!row) row = candidates.find(el => meta(el).sub.includes(w) || meta(el).title.includes(w));
            if (!row) return false;
            if (row.classList.contains('selected') || row.getAttribute('aria-checked') === 'true') return true;
            const target = row.querySelector('button, [role="button"], [role="radio"], input[type="radio"]') || row;
            target.click();
            return true;
          }, { w: wanted, rowSel: ROW_SEL }));
        }
        await this.page.waitForTimeout(900);
        
        let after = await readCurrent();
        if (!isWanted(after)) {
          await this.page.keyboard.press('Escape').catch(() => {});
          await this.page.waitForTimeout(500);
          after = await readCurrent();
        }
        if (isWanted(after)) {
          await this.page.keyboard.press('Escape').catch(() => {}); 
          await this.page.waitForTimeout(300);
          console.log(`✅ AI Studio model locked to: ${wanted}`);
          return true;
        }
        console.warn(`⚠️ ensureModel: attempt ${attempt} failed (clicked=${clicked}) — retrying...`);
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(400);
      }
      return false;
    } catch (e) {
      console.warn('⚠️ ensureModel warning:', e.message);
      await this.page.keyboard.press('Escape').catch(() => {});
      return false;
    }
  }

  async findInputElement() {
    const selectors = [
      'textarea[placeholder*="Start typing"]',
      'ms-prompt-textarea textarea',
      'textarea[aria-label*="prompt" i]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea'
    ];
    for (const sel of selectors) {
      const loc = this.page.locator(sel).last();
      if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) return loc;
    }
    return null;
  }
  async clickStopButton() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      return await this.page.evaluate(() => {
        const stop = document.querySelector('ms-stop-button, button[aria-label*="Stop" i], ms-run-button [class*="stop"]');
        if (stop) { stop.click(); return true; }
        const run = document.querySelector('ms-run-button');
        if (run && /stop/i.test(run.innerText || run.textContent || '')) { run.click(); return true; }
        return false;
      });
    } catch {
      return false;
    }
  }
  
  async sendMessage(text, options = {}) {
    if (options.lang) this.lang = options.lang === 'fa' ? 'fa' : 'en';
    if (!this.page || this.page.isClosed()) throw new Error(this.t('closed'));
    if (!this.page.url().includes('aistudio.google.com/prompts')) {
      await this.page.goto(AI_STUDIO_NEW_CHAT, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.page.waitForTimeout(1200);
    }
    
    await this.ensureModel(AI_STUDIO_MODEL);
    if (options.thinkingLevel) {
      await this.setThinkingLevel(options.thinkingLevel);
    } else if (options.isFirstMessage) {
      await this.setThinkingLevel(this.thinkingLevel || MAGNUM_THINKING_LEVEL);
    }
    // ★ Baseline BEFORE send — snapshot existing model-turn ids (stale-answer guard)
    const pre = await this.extractLiveState();
    this._baseline = {
      ids: (pre && pre.turnIds) || [],
      lastText: (pre && pre.bodyText) || '',
      count: (pre && pre.turnCount) || 0
    };
    const input = await this.findInputElement();
    if (!input) throw new Error(this.t('notReady'));
    await input.focus();
    await this.page.waitForTimeout(150);
    let result = null;
    for (let attempt = 1; attempt <= 2 && !(result && result.ok); attempt++) {
      result = await this.page.evaluate(injectPromptAIStudio, String(text));
      if (result && result.ok) break;
      await this.page.waitForTimeout(400);
    }
    if (!result || !result.ok) {
      throw new Error(this.t('sendFailed'));
    }
    console.log(`✅ AI Studio injection OK (method: ${result.via})`);
    await this.page.waitForTimeout(300);
    
    await this.page.keyboard.press('Control+Enter');
    await this.page.waitForTimeout(600);
    
    const started = await this.page.evaluate(() => {
      const run = document.querySelector('ms-run-button');
      const stop = document.querySelector('ms-stop-button, button[aria-label*="Stop" i]');
      const ta = document.querySelector('textarea[placeholder*="Start typing"], textarea');
      return !!stop || !ta || (ta.value || '') === '' || /stop/i.test(run ? (run.innerText || '') : '');
    });
    if (!started) {
      const runBtn = this.page.locator('ms-run-button').last();
      if (await runBtn.isVisible({ timeout: 800 }).catch(() => false)) await this.humanClick(runBtn);
    }
    await this.page.waitForTimeout(800);
  }
  async extractLiveState() {
    if (!this.page || this.page.isClosed()) return null;
    try {
      return await this.page.evaluate(() => {
        const visible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          if (!r || r.width < 2 || r.height < 2) return false;
          const st = window.getComputedStyle(el);
          return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
        };
        const norm = (s) => (s || '').replace(/\u00a0/g, ' ').trim();

        // 1) All model turns in DOM order (virtual-scroll aware)
        const allTurns = Array.from(document.querySelectorAll('ms-chat-turn'));
        const modelTurns = allTurns.filter(t => t.querySelector('.chat-turn-container.model'));
        const turnIds = modelTurns.map(t => t.id || '');
        const lastTurn = modelTurns.length ? modelTurns[modelTurns.length - 1] : null;
        const lastTurnId = lastTurn ? (lastTurn.id || '') : '';

        // 2) Run/Stop button state (global)
        const runBtn = document.querySelector('ms-run-button button') || document.querySelector('ms-run-button');
        const runText = runBtn ? norm(runBtn.innerText || runBtn.textContent || '') : '';
        const stoppable = !!(runBtn && (
          runBtn.classList.contains('stoppable') ||
          runBtn.querySelector('[class*="stoppable"]')
        ));
        const legacyStop = Array.from(document.querySelectorAll('ms-stop-button, button[aria-label*="Stop" i]')).find(visible);
        let stopVisible = stoppable || !!legacyStop || /\bstop\b/i.test(runText);

        // 3) Finished marker ONLY inside the LAST model turn (not old turns)
        let finishedMarker = false;
        if (lastTurn) {
          finishedMarker = !!lastTurn.querySelector(
            '.turn-footer button[aria-label="Good response"], .turn-footer button[aria-label="Bad response"], button.response-feedback-button'
          );
        }
        if (finishedMarker && !stoppable && !legacyStop) stopVisible = false;

        // 4) Body text ONLY from the last model turn
        let bodyText = '';
        if (lastTurn) {
          const pres = Array.from(lastTurn.querySelectorAll('ms-code-block pre, pre'))
            .filter(p => norm(p.innerText || p.textContent || '').length > 0);
          const isThoughtTurn = lastTurn.classList.contains('thought-activity-host');
          if (pres.length) {
            bodyText = norm(pres[pres.length - 1].innerText || pres[pres.length - 1].textContent || '');
          } else if (!isThoughtTurn) {
            const clone = lastTurn.cloneNode(true);
            clone.querySelectorAll('.author-label, .actions-container, .turn-footer, button, .timestamp, .model-run-time-pill, ms-thoughts, [class*="thought"]').forEach(n => n.remove());
            bodyText = norm(clone.innerText || clone.textContent || '');
          }
        }

        // 5) Error / rate-limit (last turn + global banners)
        const PLAIN_TURN_RATE_RE = /you(?:'ve| have) reached your (?:rate |usage )?limit|you(?:'ve| have) reached (?:the|your) (?:current )?(?:usage|daily) (?:cap|quota|limit)|quota for the day|wait for it to reset|upgrade to go further|too many requests[\s,!.]+please try again later|resource has been exhausted/i;
        const BANNER_RATE_RE = /reached your rate limit|please try again later|rate limit[^\n]*try again|reached your quota|quota for the day|wait for it to reset|upgrade to go further|too many requests|resource.{0,12}exhausted|(?:http|status|code|error)[^0-9\n]{0,12}429\b|\b429\s*(?:too many requests|rate limit)/i;
        let errorText = '';
        if (lastTurn) {
          const errEl = lastTurn.querySelector('.model-error, [class*="model-error"], ms-model-error, [class*="turn-error"]');
          if (errEl && visible(errEl) && !errEl.closest('pre, code, ms-code-block')) errorText = norm(errEl.innerText || errEl.textContent || '');
        }
        const banner = Array.from(document.querySelectorAll('ms-global-banner .message-section, [class*="error-banner"], [role="alert"]'))
          .filter(el => visible(el) && !el.closest('ms-chat-turn, ms-code-block, pre, code'))
          .map(el => norm(el.innerText || '')).join('\n');
        if (banner) errorText = (errorText ? errorText + '\n' : '') + banner;
        const hasCodeBlock = bodyText ? !!lastTurn && !!lastTurn.querySelector('ms-code-block pre, pre') : false;
        const isActionOrCode = hasCodeBlock || /"action"\s*:/.test(bodyText);
        const rateLimit =
          BANNER_RATE_RE.test(errorText) ||
          (!isActionOrCode && bodyText.length > 0 && bodyText.length <= 350 && PLAIN_TURN_RATE_RE.test(bodyText));

        return { bodyText, turnIds, turnCount: modelTurns.length, lastTurnId, stopVisible, finishedMarker, rateLimit, errorText };
      });
    } catch {
      return null;
    }
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
      await this.page.waitForTimeout(800);
      if (this.isAborted) throw new Error(this.t('cancelled'));
      loops++;
      const state = await this.extractLiveState();
      if (!state) continue;
      if (state.rateLimit) { const e = new Error('GEMINI_RATE_LIMIT'); e.code = 'GEMINI_RATE_LIMIT'; throw e; }

      const running = state.stopVisible;
      if (running) sawRunning = true;

      // New-turn detection by stable turn id (not fragile text compare)
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
        // Thinking models can take a long time before emitting text — be generous.
        if (loops > 240 && !sawRunning) {
          const e = new Error('NO_NEW_RESPONSE: Gemini never started a new reply.');
          e.code = 'NO_NEW_RESPONSE'; throw e;
        }
        if (loops > 420) {
          const e = new Error('NO_NEW_RESPONSE: Gemini response could not be located.');
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
          lastLen = text.length; stable = 0;
          if (typeof onProgress === 'function' && text !== lastEmitted) { onProgress({ text }); lastEmitted = text; }
        }
        const need = state.finishedMarker ? 1 : 3;
        if (stable >= need) {
          await this.page.waitForTimeout(500);
          const verify = await this.extractLiveState();
          if (verify && !verify.stopVisible && (verify.bodyText || '') === text &&
            (!state.lastTurnId || verify.lastTurnId === state.lastTurnId)) {
            console.log('✅ AI Studio response finished and verified (turn-id baseline).');
            return text;
          }
          if (verify && verify.stopVisible) sawRunning = true;
          stable = 0;
          continue;
        }
      } else {
        emptyNew++;
        stable = 0;
        if (emptyNew > 60) {
          if (state.errorText) throw new Error(this.t('errorPrefix', state.errorText));
          const e = new Error('NO_NEW_RESPONSE: Gemini started a reply but no content was captured.');
          e.code = 'NO_NEW_RESPONSE'; throw e;
        }
      }
      if (loops > 600) {
        if (text.length > 5) return text;
        throw new Error(this.t('timeout'));
      }
    }
  }
  
  // ★ Real file upload to AI Studio — selectors from live DOM
  async uploadFiles(filePaths = []) {
    if (!this.page || this.page.isClosed() || !filePaths.length) return;
    try {
      let input = this.page.locator('input[data-test-upload-file-input], ms-add-media-button input[type="file"]').first();
      if (!(await input.count().catch(() => 0))) {
        const addBtn = this.page.locator('button[data-test-id="add-media-button"], ms-add-media-button button').first();
        if (await addBtn.isVisible({ timeout: 800 }).catch(() => false)) {
          await addBtn.click().catch(() => {});
          await this.page.waitForTimeout(500);
          await this.page.keyboard.press('Escape').catch(() => {});
        }
        input = this.page.locator('input[type="file"][multiple]').first();
      }
      if (!(await input.count().catch(() => 0))) {
        console.warn('⚠️ Gemini: file input not found — upload skipped.');
        return;
      }
      console.log(`📤 Uploading ${filePaths.length} file(s) to Gemini (AI Studio)...`);
      await input.setInputFiles(filePaths);
      await this._waitForMediaReady(filePaths.length);
    } catch (err) {
      console.warn('⚠️ Gemini upload warning:', err.message);
    }
  }

  // ★ Wait until media processing completes (token-count appears, no has-error)
  async _waitForMediaReady(expectedNewFiles = 1) {
    const deadline = Date.now() + Math.min(180000, 20000 + expectedNewFiles * 60000);
    let stable = 0;
    while (Date.now() < deadline) {
      if (!this.page || this.page.isClosed()) return;
      const st = await this.page.evaluate(() => {
        const chips = Array.from(document.querySelectorAll(
          '.prompt-media-item-container, [data-test-id="prompt-media-container"]'
        ));
        return {
          total: chips.length,
          errors: chips.filter(c => c.classList.contains('has-error')).length,
          ready: chips.filter(c =>
            !c.classList.contains('has-error') &&
            !!c.querySelector('[data-test-id="token-count"]')
          ).length
        };
      }).catch(() => null);
      if (st) {
        if (st.errors > 0) throw new Error(this.t('mediaRejected'));
        if (st.total > 0 && st.ready === st.total) {
          stable++;
          if (stable >= 2) {
            console.log(`✅ Gemini media processed & ready (${st.ready}/${st.total}).`);
            return;
          }
        } else stable = 0;
      }
      await this.page.waitForTimeout(600);
    }
    console.warn('⚠️ Gemini media not fully processed before timeout — continuing anyway.');
  }

  // ★ Remove media chips (all, or only the given names)
  async clearStagedMedia(names = null) {
    if (!this.page || this.page.isClosed()) return;
    try {
      for (let i = 0; i < 20; i++) {
        const removed = await this.page.evaluate((wantNames) => {
          const chips = Array.from(document.querySelectorAll(
            '.prompt-media-item-container, [data-test-id="prompt-media-container"]'
          ));
          for (const chip of chips) {
            const name = (chip.querySelector('.name')?.textContent || '').trim();
            if (wantNames && !wantNames.includes(name)) continue;
            const btn = chip.querySelector('button[aria-label="Remove media"], .actions-container button');
            if (btn) { btn.click(); return true; }
          }
          return false;
        }, names).catch(() => false);
        if (!removed) break;
        await this.page.waitForTimeout(300);
      }
    } catch (e) { console.warn('Gemini clearStagedMedia warning:', e.message); }
  }

  async startNewChat() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      await this.page.goto(AI_STUDIO_NEW_CHAT, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.page.waitForTimeout(1200);
      this._baseline = null;
      return true;
    } catch (e) {
      console.warn('AI Studio startNewChat warning:', e.message);
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
      await this.page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 8000 });
    } catch (e) {
      console.warn('parkTab warning:', e.message);
    }
  }
  async checkChatExists(targetUrl) {
    if (!this.page || this.page.isClosed()) return true;
    if (!targetUrl || !targetUrl.includes('aistudio.google.com/prompts')) return false;
    try {
      if (this.page.url() !== targetUrl) {
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await this.page.waitForTimeout(1500);
      }
      const url = this.page.url();
      if (!url.includes('/prompts/') || url.includes('new_chat')) return false;
      return await this.page.evaluate(() => !!document.querySelector('textarea, div[contenteditable="true"]'));
    } catch {
      return true;
    }
  }
}
module.exports = GeminiDriver;
module.exports.AI_STUDIO_NEW_CHAT = AI_STUDIO_NEW_CHAT;
module.exports.AI_STUDIO_MODEL = AI_STUDIO_MODEL;
