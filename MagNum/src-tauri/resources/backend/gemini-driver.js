'use strict';





const AI_STUDIO_MODEL = process.env.MAGNUM_GEMINI_MODEL || 'gemini-3.8-flash';
const AI_STUDIO_NEW_CHAT = `https://aistudio.google.com/prompts/new_chat?model=${AI_STUDIO_MODEL}`;

const MAGNUM_THINKING_LEVEL = process.env.MAGNUM_THINKING_LEVEL || 'medium';


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
    if (!this.page || this.page.isClosed()) throw new Error('پنجره مرورگر Gemini بسته است.');
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
    const input = await this.findInputElement();
    if (!input) throw new Error('فیلد ورودی AI Studio یافت نشد (اگر صفحه لاگین گوگل باز است، اول Gemini را Connect کنید).');
    await input.focus();
    await this.page.waitForTimeout(150);
    let result = null;
    for (let attempt = 1; attempt <= 2 && !(result && result.ok); attempt++) {
      result = await this.page.evaluate(injectPromptAIStudio, String(text));
      if (result && result.ok) break;
      await this.page.waitForTimeout(400);
    }
    if (!result || !result.ok) {
      throw new Error(`تزریق متن به AI Studio ناموفق بود (روش: ${result && result.via}). یک چت جدید باز کنید و دوباره تلاش کنید.`);
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
        const cleanModelText = (txt) => {
          let t = txt || '';
          const marker = 'Expand to view model thoughts';
          const idx = t.indexOf(marker);
          if (idx >= 0) t = t.slice(idx + marker.length);
          t = t.replace(/^Model\s*(•|·)?[^\n]*\n/, '');
          return t.trim();
        };
        
        const modelHeaders = Array.from(document.querySelectorAll('*')).filter(el =>
          el.children.length === 0 && (el.textContent || '').trim() === 'Model'
        );
        const scopeRoot = modelHeaders.length ? modelHeaders[modelHeaders.length - 1] : null;
        const inScope = (el) => {
          if (!scopeRoot) return true;
          if (el === scopeRoot || el.contains(scopeRoot) || scopeRoot.contains(el)) return true;
          return (scopeRoot.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        };
        
        const runBtn = document.querySelector('ms-run-button');
        const runText = runBtn ? (runBtn.innerText || runBtn.textContent || '').trim() : '';
        const stopBtn = Array.from(document.querySelectorAll('ms-stop-button, button[aria-label*="Stop" i]')).find(visible);
        const runSpinner = runBtn ? Array.from(runBtn.querySelectorAll('mat-spinner, [class*="spinner"]')).find(visible) : null;
        let stopVisible = !!stopBtn || !!runSpinner || /(^|\b)stop\b/i.test(runText);
        
        const elapsedChip = Array.from(document.querySelectorAll('span, div, time')).find(el =>
          el.children.length === 0 && /^\d+(\.\d+)?\s?s$/i.test((el.textContent || '').trim()) && inScope(el)
        );
        const thumbsBtn = Array.from(document.querySelectorAll(
          'button[aria-label*="Good response" i], button[aria-label*="Bad response" i], button[aria-label*="Thumb" i]'
        )).find(el => visible(el) && inScope(el));
        const finishedMarker = !!elapsedChip || !!thumbsBtn;
        if (finishedMarker) stopVisible = false;
        
        let bodyText = '';
        const preEls = Array.from(document.querySelectorAll('pre')).filter(p => inScope(p) && (p.innerText || '').trim().length > 5);
        if (preEls.length) {
          const preText = (preEls[preEls.length - 1].innerText || '').trim();
          if (preText.length > 20 || preText.includes('{') || preText.includes('```')) {
            bodyText = preText;
          }
        }
        const turnSelectors = ['ms-model-message', 'model-response', '[data-test-id="model-response"]', '.model-response', 'ms-chat-message', '[class*="model-message"]', '[class*="conversation-turn"]'];
        if (!bodyText) for (const sel of turnSelectors) {
          const els = Array.from(document.querySelectorAll(sel)).filter(inScope);
          if (els.length) {
            const last = els[els.length - 1];
            const clone = last.cloneNode(true);
            clone.querySelectorAll('button, [class*="thought"], ms-thoughts, [class*="actions"], [class*="feedback"]').forEach(j => j.remove());
            bodyText = cleanModelText(clone.innerText || clone.textContent || '');
            break;
          }
        }
        if (!bodyText) {
          const mds = Array.from(document.querySelectorAll('ms-markdown, .markdown, [class*="markdown"]')).filter(inScope);
          if (mds.length) bodyText = cleanModelText(mds[mds.length - 1].innerText || mds[mds.length - 1].textContent || '');
        }
        if (!bodyText) {
          
          const pres = Array.from(document.querySelectorAll('pre')).filter(p => inScope(p) && (p.innerText || '').trim().length > 5);
          if (pres.length) bodyText = (pres[pres.length - 1].innerText || '').trim();
        }
        if (!bodyText) {
          const bodies = Array.from(document.querySelectorAll('.mat-expansion-panel-body'))
            .filter(b => inScope(b) && (b.innerText || '').trim().length > 5);
          if (bodies.length) bodyText = (bodies[bodies.length - 1].innerText || '').trim();
        }
        if (!bodyText && scopeRoot) {
          let turn = scopeRoot;
          for (let up = 0; up < 8 && turn; up++) {
            turn = turn.parentElement;
            if (turn && (turn.innerText || '').length > 40) break;
          }
          if (turn) bodyText = cleanModelText(turn.innerText || '');
        }
        
        const errorEl = Array.from(document.querySelectorAll(
          '.model-error, [class*="model-error"], ms-model-error, [class*="turn-error"], [class*="error-banner"]'
        )).filter(el => visible(el) && inScope(el)).pop();
        const errorText = errorEl ? (errorEl.innerText || errorEl.textContent || '').trim() : '';
        if (errorText && !bodyText) bodyText = errorText;

        
        const RATE_RE = /reached your rate limit|please try again later|rate limit[^\n]*try again|reached your quota|quota for the day|wait for it to reset|upgrade to go further|too many requests|resource.{0,12}exhausted|\b429\b/i;
        let rateLimit = RATE_RE.test(errorText || '') || RATE_RE.test(bodyText || '');
        if (!rateLimit && scopeRoot) {
          let turn = scopeRoot;
          for (let up = 0; up < 8 && turn; up++) {
            turn = turn.parentElement;
            if (turn && (turn.innerText || '').length > 20) break;
          }
          if (turn) rateLimit = RATE_RE.test(turn.innerText || '');
        }
        return { bodyText, stopVisible, finishedMarker, rateLimit, errorText };
      });
    } catch {
      return null;
    }
  }
  async waitForCompletion(onProgress, onStatus = null) {
    this.isAborted = false;
    let lastBodyLength = 0;
    let stableSeconds = 0;
    let idleEmpty = 0;
    let waitLoops = 0;
    let sawRunning = false;
    const initialState = await this.extractLiveState();
    const initialText = (initialState && typeof initialState.bodyText === 'string') ? initialState.bodyText.trim() : '';
    await this.page.waitForTimeout(1500);
    while (true) {
      if (this.isAborted) throw new Error('Task was cancelled by user.');
      if (!this.page || this.page.isClosed()) throw new Error('Gemini browser window was closed.');
      await this.page.waitForTimeout(1000);
      if (this.isAborted) throw new Error('Task was cancelled by user.');
      waitLoops++;
      const state = await this.extractLiveState();
      if (!state) continue;
      
      
      if (state.rateLimit) {
        console.warn('⚠️ Gemini rate limit / daily quota detected in AI Studio.');
        const err = new Error('GEMINI_RATE_LIMIT');
        err.code = 'GEMINI_RATE_LIMIT';
        throw err;
      }
      if (state.stopVisible) {
        sawRunning = true;
        stableSeconds = 0;
        idleEmpty = 0;
        if (typeof onStatus === 'function') onStatus('Gemini (AI Studio) is thinking and writing code...');
        
        continue;
      }
      const rawText = (state.bodyText || '').trim();
      const stripStale = (t) => {
        if (!initialText || t === initialText) return '';
        if (t.startsWith(initialText)) return t.slice(initialText.length).trim();
        return t;
      };
      const currentText = stripStale(rawText);

      if (rawText.length > 5) {
        const isNewContent = currentText.length > 0;
        const canAccept = isNewContent || sawRunning;
        if (!canAccept) {
          if (waitLoops > 50 && !sawRunning) {
            const err = new Error('NO_NEW_RESPONSE: Gemini never started a new reply for this turn.');
            err.code = 'NO_NEW_RESPONSE';
            throw err;
          }
          if (typeof onStatus === 'function') onStatus('Gemini (AI Studio) is thinking and writing code...');
          continue;
        }
        if (currentText.length === lastBodyLength) {
          stableSeconds++;
          const need = 2; 
          if (stableSeconds >= need) {
            
            await this.page.waitForTimeout(800);
            const verifyState = await this.extractLiveState();
            const verifiedText = stripStale((verifyState && verifyState.bodyText ? verifyState.bodyText.trim() : ''));
            if (verifyState && !verifyState.stopVisible && verifiedText === currentText && verifiedText.length > 5) {
              console.log('✅ AI Studio response finished and verified.');
              return verifiedText;
            }
            
            if (verifyState && verifyState.stopVisible) sawRunning = true;
            stableSeconds = 0;
            idleEmpty = 0;
            continue;
          }
        } else {
          lastBodyLength = currentText.length;
          stableSeconds = 0;
          if (onProgress) onProgress({ text: currentText });
        }
        idleEmpty = 0;
        continue;
      }
      idleEmpty++;
      if (typeof onStatus === 'function') onStatus('Reading Gemini response...');
      const limit = state.finishedMarker ? 8 : 20;
      if (idleEmpty >= limit) {
        throw new Error('Gemini response finished but content could not be captured (AI Studio UI changed?). Please re-send your prompt.');
      }
    }
  }
  
  async startNewChat() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      await this.page.goto(AI_STUDIO_NEW_CHAT, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.page.waitForTimeout(1200);
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
