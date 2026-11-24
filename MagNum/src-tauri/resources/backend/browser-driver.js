'use strict';

const DS_MSG = {
  en: {
    closed: 'DeepSeek session was closed. Please reconnect.',
    notReady: 'DeepSeek is not ready to receive messages yet. Please check your connection.',
    unavailable: 'DeepSeek session is currently unavailable.',
    cancelled: 'Task was cancelled by user.',
    thinking: 'DeepSeek is thinking...',
    writing: 'DeepSeek is writing...',
    preparing: 'DeepSeek is preparing response...',
    netHiccup: 'Network hiccup detected — checking DeepSeek status...',
    netNoRecover: 'DeepSeek reported a network error and could not recover automatically.',
    netPersisted: (max) => `DeepSeek network error persisted after ${max} automatic retries.`,
    netRetryingIn: (sec, a, m) => `Network error — retrying in ${sec}s (${a}/${m})...`,
    netWaiting: (a, m) => `Network retry (${a}/${m}) — waiting for DeepSeek response...`,
    captchaWaiting: 'Waiting for CAPTCHA verification in the DeepSeek window...',
    captchaResolved: 'CAPTCHA verified — waiting for DeepSeek response...'
  },
  fa: {
    closed: 'اتصال با \u200FDeepSeek\u200F قطع شده است. لطفاً دوباره متصل شوید.',
    notReady: '\u200FDeepSeek\u200F هنوز آماده دریافت پیام نیست. لطفاً اتصال خود را بررسی کنید.',
    unavailable: 'نشست \u200FDeepSeek\u200F در دسترس نیست.',
    cancelled: 'عملیات توسط کاربر متوقف شد.',
    thinking: '\u200FDeepSeek\u200F در حال فکر کردن است...',
    writing: '\u200FDeepSeek\u200F در حال نوشتن پاسخ است...',
    preparing: '\u200FDeepSeek\u200F در حال آماده‌سازی پاسخ است...',
    netHiccup: 'اختلال موقت شبکه شناسایی شد — در حال بررسی وضعیت \u200FDeepSeek\u200F...',
    netNoRecover: 'خطای شبکه در \u200FDeepSeek\u200F رخ داد و بازیابی خودکار انجام نشد.',
    netPersisted: (max) => `خطای شبکه در \u200FDeepSeek\u200F پس از \u200F${max}\u200F تلاش مجدد برطرف نشد.`,
    netRetryingIn: (sec, a, m) => `خطای شبکه — تلاش مجدد تا \u200F${sec}\u200F ثانیه دیگر (\u200F${a}/${m}\u200F)...`,
    netWaiting: (a, m) => `تلاش مجدد شبکه (\u200F${a}/${m}\u200F) — در انتظار پاسخ \u200FDeepSeek\u200F...`,
    captchaWaiting: 'در انتظار حل کپچا در پنجره \u200FDeepSeek\u200F...',
    captchaResolved: 'کپچا تأیید شد — در انتظار پاسخ \u200FDeepSeek\u200F...'
  }
};

class DeepSeekDriver {
  constructor(page) {
    this.page = page;
    this.isAborted = false;
    this._baseline = null;
    this.lang = 'en';
    this._cursor = null;
    this._onCaptcha = null;
  }

  t(key, ...args) {
    const table = DS_MSG[this.lang === 'fa' ? 'fa' : 'en'] || DS_MSG.en;
    const v = table[key];
    return typeof v === 'function' ? v(...args) : v;
  }

  abort() {
    this.isAborted = true;
    this.clickStopButton().catch(() => {});
  }

  async humanMoveTo(targetX, targetY) {
    if (!this.page || this.page.isClosed()) return;
    const vp = this.page.viewportSize() || { width: 1280, height: 800 };
    const start = this._cursor || {
      x: Math.round(vp.width * (0.28 + Math.random() * 0.44)),
      y: Math.round(vp.height * (0.45 + Math.random() * 0.35)),
    };
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      await this.page.mouse.move(targetX, targetY);
      this._cursor = { x: targetX, y: targetY };
      return;
    }

    const spread = Math.min(90, Math.max(12, dist * (0.12 + Math.random() * 0.18)));
    const sign = Math.random() < 0.5 ? 1 : -1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const tCtrl = 0.35 + Math.random() * 0.3;
    const cx = start.x + dx * tCtrl + nx * spread * sign;
    const cy = start.y + dy * tCtrl + ny * spread * sign;

    const steps = Math.min(22, Math.max(8, Math.round(dist / 35) + Math.floor(Math.random() * 5)));
    for (let i = 1; i <= steps; i++) {
      if (this.isAborted || !this.page || this.page.isClosed()) break;
      const rawT = i / steps;
      const t = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
      const inv = 1 - t;
      const jitter = i < steps ? (Math.random() - 0.5) * 2.2 : 0;
      const x = inv * inv * start.x + 2 * inv * t * cx + t * t * targetX + jitter;
      const y = inv * inv * start.y + 2 * inv * t * cy + t * t * targetY + jitter;
      await this.page.mouse.move(x, y);
      await this.page.waitForTimeout(Math.floor(Math.random() * 12) + 6);
    }
    this._cursor = { x: targetX, y: targetY };
  }

  async humanClick(target) {
    if (!this.page || this.page.isClosed()) return false;
    try {
      let box = null;
      let locator = null;

      if (typeof target === 'string') {
        locator = this.page.locator(target).last();
      } else if (target && typeof target.boundingBox === 'function') {
        locator = target;
      }
      if (!locator) return false;

      await locator.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
      box = await locator.boundingBox({ timeout: 2000 }).catch(() => null);
      if (!box || box.width <= 0 || box.height <= 0) return false;

      const offsetX = box.width * (0.25 + Math.random() * 0.5);
      const offsetY = box.height * (0.25 + Math.random() * 0.5);
      const clickX = box.x + offsetX;
      const clickY = box.y + offsetY;

      await this.humanMoveTo(clickX, clickY);
      await this.page.waitForTimeout(Math.floor(Math.random() * 55) + 35);
      await this.page.mouse.down();
      await this.page.waitForTimeout(Math.floor(Math.random() * 55) + 40);
      await this.page.mouse.up();
      return true;
    } catch {
      return false;
    }
  }

  async clickSendButton() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      const found = await this.page.evaluate(() => {
        document.querySelectorAll('[data-magnum-send-target]').forEach(el => el.removeAttribute('data-magnum-send-target'));
        const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
        const sendBtn = buttons.reverse().find(b => {
          const cls = (b.className || '').toString();
          const isPrimary = cls.includes('ds-button--primary');
          const isCircle = cls.includes('ds-button--circle');
          const isDisabled = b.hasAttribute('disabled') || cls.includes('ds-button--disabled') || b.getAttribute('aria-disabled') === 'true';
          if (!isPrimary || !isCircle || isDisabled) return false;
          const r = b.getBoundingClientRect();
          return r && r.width > 10 && r.height > 10;
        });
        if (!sendBtn) return false;
        sendBtn.setAttribute('data-magnum-send-target', '1');
        return true;
      });
      if (!found) return false;

      const sendLoc = this.page.locator('[data-magnum-send-target="1"]').first();
      let clicked = await this.humanClick(sendLoc);
      if (!clicked) {
        clicked = await sendLoc.click({ timeout: 1500 }).then(() => true).catch(() => false);
      }
      await this.page.evaluate(() => {
        document.querySelectorAll('[data-magnum-send-target]').forEach(el => el.removeAttribute('data-magnum-send-target'));
      }).catch(() => {});
      return clicked;
    } catch {
      return false;
    }
  }

  async clickStopButton() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      return await this.page.evaluate(() => {
        const inputEl = document.querySelector('#chat-input, textarea, [contenteditable="true"]');
        const chatVal = inputEl ? ((inputEl.value !== undefined ? inputEl.value : inputEl.innerText) || '').trim() : '';
        const hasStopRect = (svg) => {
          if (!svg) return false;
          return Array.from(svg.querySelectorAll('rect')).some(r => !r.closest('clipPath, defs'));
        };
        const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const stop = btns.find(b => {
          const cls = (b.className || '').toString();
          if (b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true' || cls.includes('ds-button--disabled')) {
            return false;
          }
          const r = b.getBoundingClientRect();
          if (r.width <= 10 || r.height <= 10) return false;
          const aria = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
          const svg = b.querySelector('svg');
          if (/stop/i.test(aria) || hasStopRect(svg)) return true;
          if (cls.includes('ds-button--primary') && cls.includes('ds-button--circle') && chatVal === '') {
            const html = svg ? svg.innerHTML : '';
            if (!html.includes('M8.3125 0.980206')) return true;
          }
          return false;
        });
        if (stop) { stop.click(); return true; }
        return false;
      });
    } catch { return false; }
  }

  async clickContinueButton() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      const continueLoc = this.page.locator(
        'div[role="button"]:has-text("Continue"), button:has-text("Continue"), div[role="button"]:has-text("ادامه")'
      ).last();

      if (await continueLoc.isVisible({ timeout: 500 }).catch(() => false)) {
        return await this.humanClick(continueLoc);
      }
    } catch {}
    return false;
  }

  
  async clickRetryButton(kind = 'auto') {
    if (!this.page || this.page.isClosed()) return false;
    try {
      const found = await this.page.evaluate((preferredKind) => {
        document.querySelectorAll('[data-magnum-retry-target]').forEach(el => el.removeAttribute('data-magnum-retry-target'));

        const visible = (el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          if (!r || r.width < 4 || r.height < 4) return false;
          const st = window.getComputedStyle(el);
          return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
        };
        const enabled = (el) =>
          !el.hasAttribute('disabled') &&
          el.getAttribute('aria-disabled') !== 'true' &&
          !(el.className || '').toString().includes('ds-button--disabled');

        const legacyUserSel = '[class*="user-message"], [class*="UserMessage"], [data-message-author-role="user"], [data-role="user"]';
        let userEls = Array.from(document.querySelectorAll(legacyUserSel)).filter(visible);
        if (!userEls.length) {
          const turnItems = Array.from(document.querySelectorAll('[data-virtual-list-item-key]')).filter(visible);
          userEls = turnItems.filter(item => {
            const msg = item.querySelector('.ds-message');
            if (!msg) return false;
            if (item.querySelector('.ds-markdown, .ds-assistant-message-main-content, [class*="think-content"], [class*="thinking"]')) return false;
            if (item.querySelector('[aria-label="Read aloud"], [aria-label*="good response" i], [aria-label*="bad response" i]')) return false;
            const key = item.getAttribute('data-virtual-list-item-key') || '';
            if (key.startsWith('-')) return true;
            if (msg.querySelector('.ds-collapsible-text, .ds-button--warning, .fbb737a4')) return true;
            if (item.querySelector('.ds-loading, [class*="loading"], [class*="spinner"]')) return false;
            return (msg.innerText || '').trim().length > 0;
          });
        }
        const lastUserEl = userEls.length ? userEls[userEls.length - 1] : null;
        const afterLastUser = (el) =>
          !lastUserEl ||
          el === lastUserEl ||
          (lastUserEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

        let target = null;

        // 1. دکمه زرد Retry روی پیام خطادار کاربر
        const warningBtns = Array.from(document.querySelectorAll('div[role="button"].ds-button--warning, button.ds-button--warning'))
          .filter(b => visible(b) && enabled(b) && afterLastUser(b));
        if (warningBtns.length) {
          target = warningBtns[warningBtns.length - 1];
        }

        // 2. دکمه متنی یا aria-label Retry/Try again خارج از متن پیام‌ها
        if (!target) {
          const btns = Array.from(document.querySelectorAll('button, div[role="button"]')).filter(b => {
            if (!visible(b) || !enabled(b) || !afterLastUser(b)) return false;
            if (b.closest('.ds-markdown, .ds-collapsible-text, pre, code')) return false;
            const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
            const txt = (b.innerText || '').trim().toLowerCase();
            return /retry|try again|regenerate|resend/.test(label) || /^(retry|try again|resend)$/.test(txt);
          });
          if (btns.length) target = btns[btns.length - 1];
        }

        // 3. خطای سرور در پاسخ دستیار -> دکمه Regenerate در نوار اکشن پیام دستیار
        if (!target && preferredKind === 'assistant_error') {
          const turnItems = Array.from(document.querySelectorAll('[data-virtual-list-item-key]')).filter(visible);
          const lastAssistantItem = [...turnItems].reverse().find(it =>
            afterLastUser(it) && !userEls.includes(it) && it.querySelector('.ds-markdown, .ds-assistant-message-main-content')
          );
          if (lastAssistantItem) {
            const actionBtns = Array.from(lastAssistantItem.querySelectorAll('div[role="button"], button'))
              .filter(b => visible(b) && enabled(b) && !b.closest('.ds-markdown'));
            const regen = actionBtns.find(b => b.getAttribute('aria-disabled') === 'false') || actionBtns[1];
            if (regen) target = regen;
          }
        }

        if (!target) return false;
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
        target.setAttribute('data-magnum-retry-target', '1');
        return true;
      }, kind);

      if (!found) return false;
      await this.page.waitForTimeout(120);

      const targetLoc = this.page.locator('[data-magnum-retry-target="1"]').first();
      let clicked = await this.humanClick(targetLoc);
      if (!clicked) {
        clicked = await targetLoc.click({ force: true, timeout: 1500 }).then(() => true).catch(() => false);
      }
      if (!clicked) {
        clicked = await this.page.evaluate(() => {
          const el = document.querySelector('[data-magnum-retry-target="1"]');
          if (el) { el.click(); return true; }
          return false;
        }).catch(() => false);
      }

      await this.page.evaluate(() => {
        document.querySelectorAll('[data-magnum-retry-target]').forEach(el => el.removeAttribute('data-magnum-retry-target'));
      }).catch(() => {});

      return clicked;
    } catch {
      return false;
    }
  }

  async setDeepThink(enable = true) {
    if (!this.page || this.page.isClosed()) return;
    try {
      const dtBtn = this.page.locator('button, div[role="button"]').filter({ hasText: /DeepThink|R1/i }).first();
      if (await dtBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        const isCurrentlyActive = await this.getDeepThinkState();
        if (isCurrentlyActive !== enable) {
          await this.humanClick(dtBtn);
          await this.page.waitForTimeout(400);
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not toggle DeepThink:', e.message);
    }
  }

  async getDeepThinkState() {
    if (!this.page || this.page.isClosed()) return null;
    try {
      return await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, div[role="button"], div[class*="toggle"], div[class*="button"]'));
        const dtBtn = elements.find(el => {
          const txt = (el.innerText || el.textContent || '').trim();
          return txt.includes('DeepThink') || txt.includes('R1');
        });
        if (!dtBtn) return null;

        const cls = dtBtn.getAttribute('class') || '';
        const ariaChecked = dtBtn.getAttribute('aria-checked');
        const ariaPressed = dtBtn.getAttribute('aria-pressed');

        return (
          ariaChecked === 'true' ||
          ariaPressed === 'true' ||
          cls.includes('selected') ||
          cls.includes('active') ||
          cls.includes('checked') ||
          !!dtBtn.querySelector('[class*="active"], [class*="selected"]')
        );
      });
    } catch {
      return null;
    }
  }

  async findInputElement() {
    const selectors = ['#chat-input', 'textarea#chat-input', 'textarea', '[contenteditable="true"]'];
    for (const sel of selectors) {
      const loc = this.page.locator(sel).last();
      if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) return loc;
    }
    return null;
  }

  async uploadFiles(filePaths = []) {
    if (!this.page || this.page.isClosed() || !filePaths || filePaths.length === 0) return;
    try {
      const fileInput = this.page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        console.log(`📤 Uploading ${filePaths.length} file(s) to DeepSeek Web...`);
        await fileInput.setInputFiles(filePaths);
        const names = filePaths.map(p => require('node:path').basename(p));
        const deadline = Date.now() + Math.min(60000, 8000 + filePaths.length * 15000);
        while (Date.now() < deadline) {
          const ok = await this.page.evaluate((ns) => {
            const body = document.body ? document.body.innerText : '';
            return ns.every(n => body.includes(n));
          }, names).catch(() => false);
          if (ok) break;
          await this.page.waitForTimeout(700);
        }
        await this.page.waitForTimeout(800);
      }
    } catch (err) {
      console.warn('⚠️ File upload warning:', err.message);
    }
  }

  async clearStagedMedia(names = null) {
    if (!this.page || this.page.isClosed()) return;
    try {
      for (let i = 0; i < 15; i++) {
        const removed = await this.page.evaluate((wantNames) => {
          const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
          const isRemove = (b) => /remove|delete|حذف/i.test(
            (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '')
          );
          if (!wantNames) {
            const b = btns.find(x => isRemove(x) && /file|attach/i.test((x.getAttribute('aria-label') || '') + (x.getAttribute('title') || '')));
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
              const b = Array.from(scope.querySelectorAll('button, div[role="button"]')).find(isRemove);
              if (b) { b.click(); return true; }
              scope = scope.parentElement;
            }
          }
          return false;
        }, names).catch(() => false);
        if (!removed) break;
        await this.page.waitForTimeout(300);
      }
    } catch (e) { console.warn('DeepSeek clearStagedMedia warning:', e.message); }
  }

  
  async sendMessage(text, options = {}) {
    if (options.lang) this.lang = options.lang === 'fa' ? 'fa' : 'en';
    if (!this.page || this.page.isClosed()) throw new Error(this.t('closed'));
    if (typeof options.deepThink === 'boolean') await this.setDeepThink(options.deepThink);

    let preState = await this.extractLiveState();
    if (preState && preState.isLoginPage) {
      const err = new Error('DS_SESSION_EXPIRED');
      err.code = 'DS_SESSION_EXPIRED';
      throw err;
    }

    if (preState && preState.hasActiveCaptcha) {
      const onCaptcha = options.onCaptcha || this._onCaptcha;
      if (typeof onCaptcha === 'function') {
        await this._waitForCaptchaClear(onCaptcha, options.onStatus || null);
        preState = await this.extractLiveState();
      } else {
        const err = new Error('CAPTCHA_REQUIRED');
        err.code = 'CAPTCHA_REQUIRED';
        throw err;
      }
    }

    this._baseline = {
      lastUserKey: (preState && preState.lastUserKey) || '',
      userCount: (preState && preState.userCount) || 0,
      lastAssistantKey: (preState && preState.lastAssistantKey) || '',
      lastAssistantText: (preState && typeof preState.bodyText === 'string') ? preState.bodyText.trim() : ''
    };

    const input = await this.findInputElement();
    if (!input) {
      const st = await this.extractLiveState();
      if (st && st.isLoginPage) {
        const err = new Error('DS_SESSION_EXPIRED');
        err.code = 'DS_SESSION_EXPIRED';
        throw err;
      }
      throw new Error(this.t('notReady'));
    }

    const clickedInput = await this.humanClick(input);
    if (!clickedInput) await input.focus();
    await this.page.waitForTimeout(Math.floor(Math.random() * 140) + 120);

    const fullText = String(text);

    try {
      if (fullText.length <= 80 && !fullText.includes('\
') && !fullText.includes('\')) {
        await this.page.keyboard.type(fullText, { delay: Math.floor(Math.random() * 25) + 22 });
      } else {
        const CHUNK = 900;
        for (let i = 0; i < fullText.length; i += CHUNK) {
          await this.page.keyboard.insertText(fullText.slice(i, i + CHUNK));
          if (i + CHUNK < fullText.length) {
            await this.page.waitForTimeout(Math.floor(Math.random() * 35) + 20);
          }
        }
      }
    } catch (e) {}

    const isWritten = await this.page.evaluate((expectedLen) => {
      const el = document.querySelector('#chat-input, textarea');
      const val = el ? (el.value || el.innerText || '') : '';
      return val.trim().length >= Math.min(expectedLen * 0.7, 30);
    }, fullText.length);

    if (!isWritten) {
      await this.page.evaluate((content) => {
        const el = document.querySelector('#chat-input') || document.querySelector('textarea');
        if (!el) return;
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
          || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(el, content);
        else el.value = content;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, fullText);
      await this.page.waitForTimeout(220);
    }

    await this.page.waitForTimeout(Math.floor(Math.random() * 350) + 320);

    let isSent = await this.clickSendButton();
    if (!isSent) {
      await input.focus();
      await this.page.keyboard.press('Enter');
    }

    await this.page.waitForTimeout(450);

    const postCheck = await this.extractLiveState();
    if (!postCheck?.hasActiveCaptcha) {
      const stillHasContent = await this.page.evaluate(() => {
        const el = document.querySelector('#chat-input, textarea');
        return el && (el.value || el.innerText || '').trim().length > 5;
      });
      if (stillHasContent) {
        const retried = await this.clickSendButton();
        if (!retried) {
          await input.focus();
          await this.page.keyboard.press('Enter');
        }
        await this.page.waitForTimeout(300);
      }
    }

    return true;
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
        const enabled = (el) =>
          !el.hasAttribute('disabled') &&
          el.getAttribute('aria-disabled') !== 'true' &&
          !(el.className || '').toString().includes('ds-button--disabled');

        const inputEl = document.querySelector('#chat-input, textarea, [contenteditable="true"]');
        const beforeInput = (el) => {
          if (!inputEl) return true;
          return (inputEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
        };

        const legacyUserSel = '[class*="user-message"], [class*="UserMessage"], [data-message-author-role="user"], [data-role="user"]';
        const turnItems = Array.from(document.querySelectorAll('[data-virtual-list-item-key]')).filter(visible);
        let userEls = Array.from(document.querySelectorAll(legacyUserSel)).filter(visible);
        if (!userEls.length) {
          if (turnItems.length) {
            userEls = turnItems.filter(item => {
              const msg = item.querySelector('.ds-message');
              if (!msg) return false;
              if (item.querySelector('.ds-markdown, .ds-assistant-message-main-content, [class*="think-content"], [class*="thinking"]')) return false;
              if (item.querySelector('[aria-label="Read aloud"], [aria-label*="good response" i], [aria-label*="bad response" i]')) return false;
              const key = item.getAttribute('data-virtual-list-item-key') || '';
              if (key.startsWith('-')) return true;
              if (msg.querySelector('.ds-collapsible-text, .ds-button--warning, .fbb737a4')) return true;
              if (item.querySelector('.ds-loading, [class*="loading"], [class*="spinner"]')) return false;
              return (msg.innerText || '').trim().length > 0;
            });
          } else {
            userEls = Array.from(document.querySelectorAll('.ds-message')).filter(msg => {
              if (!visible(msg)) return false;
              if (msg.querySelector('.ds-markdown, .ds-assistant-message-main-content, [class*="think-content"], [class*="thinking"]')) return false;
              return !!msg.querySelector('.ds-collapsible-text, .ds-button--warning') || msg.classList.contains('d29f3d7d');
            });
          }
        }

        const lastUserEl = userEls.length ? userEls[userEls.length - 1] : null;
        const lastUserKey = lastUserEl ? (lastUserEl.getAttribute('data-virtual-list-item-key') || '') : '';
        const afterLastUser = (el) =>
          !lastUserEl ||
          el === lastUserEl ||
          (lastUserEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        const notUser = (el) => !el.closest(legacyUserSel) && !userEls.some(u => u === el || u.contains(el));
        const inThink = (el) => !!el.closest('[class*="think-content"], [class*="thinking"]');

        const leaves = Array.from(document.querySelectorAll('span, div, p'))
          .filter(el => el.children.length === 0 && visible(el) && afterLastUser(el) && beforeInput(el) && notUser(el));
        const thinkHeader = leaves.reverse().find(el => {
          const t = (el.textContent || '').trim();
          return t === 'Thinking' || /^Thought for\b/.test(t);
        });
        const isThinkingInProgress = !!(thinkHeader && /^Thinking/.test((thinkHeader.textContent || '').trim()));
        const afterThink = (el) => !thinkHeader || (thinkHeader.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

        const hasStopRect = (svg) => {
          if (!svg) return false;
          return Array.from(svg.querySelectorAll('rect')).some(r => !r.closest('clipPath, defs'));
        };
        const chatVal = inputEl ? ((inputEl.value !== undefined ? inputEl.value : inputEl.innerText) || '').trim() : '';
        let isStopButtonActive = false;
        for (const b of document.querySelectorAll('button, div[role="button"]')) {
          if (!visible(b) || !enabled(b)) continue;
          const cls = (b.className || '').toString();
          const aria = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
          const svg = b.querySelector('svg');
          if (/stop/i.test(aria) || hasStopRect(svg)) {
            isStopButtonActive = true;
            break;
          }
          if (cls.includes('ds-button--primary') && cls.includes('ds-button--circle') && chatVal === '') {
            const html = svg ? svg.innerHTML : '';
            if (!html.includes('M8.3125 0.980206')) {
              isStopButtonActive = true;
              break;
            }
          }
        }

        const assistantItemsAfterUser = turnItems.filter(it =>
          afterLastUser(it) && !userEls.includes(it) && !!it.querySelector('.ds-message')
        );
        const lastAssistantItem = assistantItemsAfterUser.length ? assistantItemsAfterUser[assistantItemsAfterUser.length - 1] : null;
        const lastAssistantKey = lastAssistantItem ? (lastAssistantItem.getAttribute('data-virtual-list-item-key') || '') : '';

        const MD_SEL = 'p[class*="ds-markdown"], [class*="ds-markdown-paragraph"], pre, [class*="code-block"]';
        const allNodes = Array.from(document.querySelectorAll(MD_SEL))
          .filter(el => !inThink(el) && afterThink(el) && notUser(el) && afterLastUser(el) && beforeInput(el) && visible(el));
        const nodes = allNodes.filter(el => !allNodes.some(o => o !== el && o.contains(el)));
        let bodyText = nodes.map(n => (n.innerText || n.textContent || '').trim()).filter(Boolean).join('\n');

        let hasCodeBlock = false;
        if (lastAssistantItem) {
          hasCodeBlock = !!lastAssistantItem.querySelector('pre, [class*="code-block"]');
        } else {
          hasCodeBlock = Array.from(document.querySelectorAll('pre, [class*="code-block"]'))
            .some(el => visible(el) && afterLastUser(el) && beforeInput(el) && notUser(el) && !inThink(el));
        }

        if (!bodyText) {
          const codeBlocks = Array.from(document.querySelectorAll('pre, code, [class*="code-block"]'))
            .filter(el => visible(el) && afterLastUser(el) && beforeInput(el) && notUser(el) && !inThink(el));
          const lastCode = codeBlocks[codeBlocks.length - 1];
          if (lastCode) {
            const codeText = (lastCode.innerText || '').trim();
            if (codeText.length > 5) bodyText = codeText;
          }
        }

        if (!bodyText) {
          const responseSelectors = [
            '[class*="chat-turn"]', '[class*="message-row"]', '[class*="chat-message"]',
            '[data-message-author-role="assistant"]', '[role="article"]',
            '.ds-assistant-message-main-content', '.ds-markdown'
          ];
          const responseContainers = Array.from(document.querySelectorAll(responseSelectors.join(',')))
            .filter(el => visible(el) && afterLastUser(el) && beforeInput(el) && notUser(el) && !inThink(el));
          const lastResponse = responseContainers[responseContainers.length - 1];
          if (lastResponse) {
            const respText = (lastResponse.innerText || '').trim();
            if (respText.length > 5) bodyText = respText;
          }
        }

        const hasBottomActions = Array.from(document.querySelectorAll(
          '[aria-label="Read aloud"], [aria-label*="copy" i], [aria-label*="good response" i], [aria-label*="bad response" i]'
        )).some(b => visible(b) && afterLastUser(b) && notUser(b));

        const hasContinueBtn = Array.from(document.querySelectorAll('div[role="button"], button'))
          .some(b => visible(b) && notUser(b) && afterLastUser(b) && beforeInput(b) && (b.innerText || '').trim() === 'Continue');

        const warningRetryBtn = Array.from(document.querySelectorAll('div[role="button"].ds-button--warning, button.ds-button--warning'))
          .find(b => visible(b) && enabled(b) && afterLastUser(b) && beforeInput(b));

        const explicitRetryBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(b => {
          if (!visible(b) || !enabled(b) || !afterLastUser(b) || !beforeInput(b)) return false;
          if (b.closest('.ds-markdown, .ds-collapsible-text, pre, code')) return false;
          const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
          const txt = (b.innerText || '').trim().toLowerCase();
          return /retry|try again|regenerate|resend/.test(label) || /^(retry|try again|resend)$/.test(txt);
        });

        const NET_ERR_RE = /check network and retry|network error|connection (?:lost|failed)|server is busy|request timed out|unable to connect|something went wrong|please try again|检查网络|网络错误|重试|请稍后再试/i;

        const turnErrorEl = Array.from(document.querySelectorAll('span, p, div')).find(el => {
          if (el.children.length > 0 || !visible(el)) return false;
          if (!afterLastUser(el) || !beforeInput(el)) return false;
          if (el.closest('.ds-message, .ds-markdown, .ds-collapsible-text, pre, code')) return false;
          const t = (el.innerText || el.textContent || '').trim();
          return t.length > 0 && t.length <= 220 && NET_ERR_RE.test(t);
        });

        const toastErrorEl = Array.from(document.querySelectorAll('.ds-toast-container *, .ds-notification-container *')).find(el => {
          if (el.children.length > 0 || !visible(el)) return false;
          const t = (el.innerText || el.textContent || '').trim();
          return t.length > 0 && t.length <= 220 && NET_ERR_RE.test(t);
        });

        const ASSISTANT_NET_ERR_RE = /^(?:the\s+)?server is busy\b|network error|check network and retry|something went wrong|unable to connect|connection (?:lost|failed)|please try again later/i;
        const assistantNetworkError = Boolean(
          !hasCodeBlock &&
          bodyText &&
          bodyText.length <= 250 &&
          !/"action"\s*:/.test(bodyText) &&
          ASSISTANT_NET_ERR_RE.test(bodyText.trim())
        );

        const hasNetworkError = Boolean(warningRetryBtn || explicitRetryBtn || turnErrorEl || toastErrorEl || assistantNetworkError);
        const hasRetryButton = Boolean(warningRetryBtn || explicitRetryBtn || assistantNetworkError);
        const retryKind = warningRetryBtn ? 'warning_btn' : explicitRetryBtn ? 'explicit_btn' : assistantNetworkError ? 'assistant_error' : null;

        const isElemTrulyVisible = (el) => {
          if (!el) return false;
          let cur = el;
          while (cur && cur.nodeType === 1) {
            if (cur.getAttribute('aria-hidden') === 'true') return false;
            const s = window.getComputedStyle(cur);
            if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
            if (s.zIndex && parseInt(s.zIndex, 10) < 0) return false;
            cur = cur.parentElement;
          }
          const r = el.getBoundingClientRect();
          if (!r || r.width < 10 || r.height < 10) return false;
          const vw = window.innerWidth || 1280;
          const vh = window.innerHeight || 800;
          return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
        };

        let hasActiveCaptcha = false;
        const cfOverlay = document.querySelector('#cf-overlay');
        const dsPrompt = document.querySelector('.ds-hcaptcha-prompt');
        if (isElemTrulyVisible(cfOverlay) || isElemTrulyVisible(dsPrompt)) {
          hasActiveCaptcha = true;
        }
        if (!hasActiveCaptcha) {
          for (const f of Array.from(document.querySelectorAll('iframe'))) {
            const src = (f.getAttribute('src') || '').toLowerCase();
            const title = (f.getAttribute('title') || '').toLowerCase();
            if (
              src.includes('hcaptcha.com') ||
              src.includes('challenges.cloudflare.com') ||
              title.includes('hcaptcha') ||
              title.includes('cloudflare')
            ) {
              const r = f.getBoundingClientRect();
              if (r.width >= 120 && r.height >= 120 && isElemTrulyVisible(f)) {
                hasActiveCaptcha = true;
                break;
              }
            }
          }
        }

        const url = location.href || '';
        const ph = (el) => (el.getAttribute && (el.getAttribute('placeholder') || '')) || '';
        const inputs = Array.from(document.querySelectorAll('input'));
        const phoneOrEmail = inputs.some(i => /phone|email|mobile/i.test(ph(i)));
        const password = inputs.some(i => i.type === 'password' || /password/i.test(ph(i)));
        const codeInput = inputs.some(i => /code|otp|verification/i.test(ph(i)));
        const loginBtn = Array.from(document.querySelectorAll('div[role="button"], button, a')).some(el => {
          const t = (el.innerText || el.textContent || '').trim();
          return /^(log in|sign in|log in with google|continue with google|send code)$/i.test(t);
        });
        const authForm = !!document.querySelector(
          '.ds-auth-form-wrapper, .ds-sign-in-form-wrapper, .ds-sign-in-form__main'
        );
        const rawToken = localStorage.getItem('userToken');
        let hasToken = false;
        if (rawToken) {
          try { const p = JSON.parse(rawToken); hasToken = !!(p && (p.value || p)); }
          catch { hasToken = rawToken.length > 10; }
        }
        const isLoginPage =
          /\/sign_in|\/login/i.test(url) ||
          (phoneOrEmail && (password || codeInput || loginBtn)) ||
          (authForm && (loginBtn || phoneOrEmail || password)) ||
          (!hasToken && loginBtn && !inputEl);

        return {
          bodyText,
          lastUserKey,
          userCount: userEls.length,
          lastAssistantKey,
          isThinkingInProgress,
          isStopButtonActive,
          hasBottomActions,
          hasContinueBtn,
          hasNetworkError,
          hasRetryButton,
          retryKind,
          hasActiveCaptcha,
          isLoginPage
        };
      });
    } catch {
      return null;
    }
  }

  
  async _waitForCaptchaClear(onCaptcha, onStatus = null) {
    onCaptcha({ active: true, url: this.page.url() });
    let clearCount = 0;
    let captchaTicks = 0;
    const MAX_CAPTCHA_TICKS = 260; // ~3 minutes

    while (true) {
      if (this.isAborted) {
        try { onCaptcha({ active: false }); } catch {}
        throw new Error(this.t('cancelled'));
      }
      if (!this.page || this.page.isClosed()) {
        try { onCaptcha({ active: false }); } catch {}
        throw new Error(this.t('closed'));
      }
      await this.page.waitForTimeout(700);
      if (this.isAborted) {
        try { onCaptcha({ active: false }); } catch {}
        throw new Error(this.t('cancelled'));
      }
      captchaTicks++;
      if (captchaTicks > MAX_CAPTCHA_TICKS) {
        const err = new Error('CAPTCHA_REQUIRED');
        err.code = 'CAPTCHA_REQUIRED';
        throw err;
      }
      const cState = await this.extractLiveState();
      if (!cState) continue;
      if (cState.isLoginPage) {
        try { onCaptcha({ active: false }); } catch {}
        const err = new Error('DS_SESSION_EXPIRED');
        err.code = 'DS_SESSION_EXPIRED';
        throw err;
      }
      if (cState.hasActiveCaptcha) {
        clearCount = 0;
        if (typeof onStatus === 'function') onStatus(this.t('captchaWaiting'));
      } else {
        clearCount++;
        if (clearCount >= 2) break;
      }
    }

    onCaptcha({ active: false });
    if (typeof onStatus === 'function') onStatus(this.t('captchaResolved'));
    await this.page.waitForTimeout(900);
  }

  async waitForCompletion(onProgress, onStatus = null, onRetry = null, onCaptcha = null) {
    this.isAborted = false;
    let lastBodyLength = 0;
    let stableChecks = 0;
    let idleTicks = 0;
    let waitLoops = 0;
    let sawRunning = false;
    let networkRetryAttempts = 0;
    let networkErrorTicks = 0;
    let captchaWaitTicks = 0;
    let captchaJustResolved = false;
    const MAX_NETWORK_RETRIES = 5;

    const baseline = this._baseline;
    const initialState = baseline ? null : await this.extractLiveState();
    const initialText = baseline
      ? (baseline.lastAssistantText || '')
      : ((initialState && typeof initialState.bodyText === 'string') ? initialState.bodyText.trim() : '');

    await this.page.waitForTimeout(1000);

    try {
      while (true) {
        if (this.isAborted) throw new Error(this.t('cancelled'));
        if (!this.page || this.page.isClosed()) throw new Error(this.t('closed'));

        await this.page.waitForTimeout(800);
        if (this.isAborted) throw new Error(this.t('cancelled'));
        waitLoops++;

        const state = await this.extractLiveState();
        if (!state) continue;

        if (state.hasActiveCaptcha) {
          const captchaCb = onCaptcha || this._onCaptcha;
          if (typeof captchaCb === 'function') {
            await this._waitForCaptchaClear(captchaCb, onStatus);
            captchaJustResolved = true;
            captchaWaitTicks = 0;
            idleTicks = 0;
            waitLoops = 0;
            networkErrorTicks = 0;
            stableChecks = 0;
            continue;
          }
          const err = new Error('CAPTCHA_REQUIRED');
          err.code = 'CAPTCHA_REQUIRED';
          throw err;
        }

        if (state.isLoginPage) {
          const err = new Error('DS_SESSION_EXPIRED');
          err.code = 'DS_SESSION_EXPIRED';
          throw err;
        }

        if (state.isThinkingInProgress) {
          sawRunning = true;
          stableChecks = 0;
          idleTicks = 0;
          networkErrorTicks = 0;
          if (typeof onStatus === 'function') onStatus(this.t('thinking'));
          continue;
        }

        if (state.isStopButtonActive) {
          sawRunning = true;
          stableChecks = 0;
          idleTicks = 0;
          networkErrorTicks = 0;
          if (typeof onStatus === 'function') onStatus(this.t('writing'));
          continue;
        }

        if (state.hasContinueBtn && !state.isStopButtonActive) {
          sawRunning = true;
          await this.clickContinueButton();
          await this.page.waitForTimeout(1500);
          stableChecks = 0;
          idleTicks = 0;
          networkErrorTicks = 0;
          continue;
        }

        if (state.hasRetryButton || state.hasNetworkError) {
          if (!state.hasRetryButton) {
            networkErrorTicks++;
            if (networkErrorTicks < 6) {
              if (typeof onStatus === 'function') onStatus(this.t('netHiccup'));
              continue;
            }
            throw new Error(this.t('netNoRecover'));
          }

          networkErrorTicks = 0;
          networkRetryAttempts++;
          if (networkRetryAttempts > MAX_NETWORK_RETRIES) {
            throw new Error(this.t('netPersisted', MAX_NETWORK_RETRIES));
          }

          const minMs = 3000 + (networkRetryAttempts - 1) * 1000;
          const maxMs = 6000 + (networkRetryAttempts - 1) * 1500;
          const delayMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
          const sec = (delayMs / 1000).toFixed(1);

          console.log(`⚠️ [Network Retry ${networkRetryAttempts}/${MAX_NETWORK_RETRIES}] Detected (${state.retryKind}). Waiting ${sec}s before clicking retry...`);
          const statusMsg = this.t('netRetryingIn', sec, networkRetryAttempts, MAX_NETWORK_RETRIES);
          if (typeof onStatus === 'function') onStatus(statusMsg);
          if (typeof onRetry === 'function') {
            onRetry({ attempt: networkRetryAttempts, max: MAX_NETWORK_RETRIES, text: statusMsg });
          }

          const waitStart = Date.now();
          while (Date.now() - waitStart < delayMs) {
            if (this.isAborted) throw new Error(this.t('cancelled'));
            if (!this.page || this.page.isClosed()) throw new Error(this.t('closed'));
            await this.page.waitForTimeout(200);
          }

          const preClickState = await this.extractLiveState();
          if (preClickState && (preClickState.isThinkingInProgress || preClickState.isStopButtonActive)) {
            sawRunning = true;
            stableChecks = 0;
            idleTicks = 0;
            continue;
          }

          const kindToClick = (preClickState && preClickState.retryKind) || state.retryKind || 'auto';
          const clicked = await this.clickRetryButton(kindToClick);
          console.log(`🔄 [Network Retry ${networkRetryAttempts}/${MAX_NETWORK_RETRIES}] clickRetryButton(${kindToClick}) -> ${clicked}`);

          if (clicked) {
            if (typeof onStatus === 'function') {
              onStatus(this.t('netWaiting', networkRetryAttempts, MAX_NETWORK_RETRIES));
            }
            for (let t = 0; t < 10; t++) {
              if (this.isAborted) throw new Error(this.t('cancelled'));
              await this.page.waitForTimeout(250);
              const post = await this.extractLiveState();
              if (!post || !post.hasRetryButton || post.isStopButtonActive || post.isThinkingInProgress) break;
            }
            lastBodyLength = 0;
            stableChecks = 0;
            idleTicks = 0;
            waitLoops = 0;
            sawRunning = false;
          }
          continue;
        }
        networkErrorTicks = 0;

        if (captchaJustResolved && !sawRunning && !state.hasRetryButton && !state.hasNetworkError) {
          captchaWaitTicks++;
          if (captchaWaitTicks === 6) {
            const unsent = await this.page.evaluate(() => {
              const el = document.querySelector('#chat-input, textarea');
              return el && (el.value || el.innerText || '').trim().length > 5;
            }).catch(() => false);
            if (unsent) {
              await this.clickSendButton();
            }
            captchaJustResolved = false;
          }
        }

        const isTurnConfirmedNew = Boolean(
          baseline && (
            (state.lastUserKey && state.lastUserKey !== baseline.lastUserKey) ||
            state.userCount > baseline.userCount ||
            (state.lastAssistantKey && state.lastAssistantKey !== baseline.lastAssistantKey)
          )
        );

        const stripStale = (t) => {
          if (isTurnConfirmedNew) return t;
          if (!initialText || t === initialText) return '';
          if (t.startsWith(initialText)) return t.slice(initialText.length).trim();
          return t;
        };

        const rawText = (state.bodyText || '').trim();
        const currentText = stripStale(rawText);

        if (rawText.length > 5) {
          const isStrictlyNew = currentText.length > 0;

          if (!isStrictlyNew) {
            if (waitLoops > 60 && !sawRunning) {
              const err = new Error('NO_NEW_RESPONSE: DeepSeek never started a new reply for this turn.');
              err.code = 'NO_NEW_RESPONSE';
              throw err;
            }
            if (typeof onStatus === 'function') onStatus(this.t('preparing'));
            continue;
          }

          if (currentText.length === lastBodyLength) {
            stableChecks++;
          } else {
            lastBodyLength = currentText.length;
            stableChecks = 0;
            if (onProgress) onProgress({ text: currentText });
          }

          if (stableChecks >= 3 || (state.hasBottomActions && stableChecks >= 2)) {
            await this.page.waitForTimeout(1000);
            const verifyState = await this.extractLiveState();

            if (
              verifyState &&
              !verifyState.isStopButtonActive &&
              !verifyState.isThinkingInProgress &&
              !verifyState.hasRetryButton &&
              !verifyState.hasNetworkError
            ) {
              const verifiedText = stripStale((verifyState.bodyText || '').trim());
              if (verifiedText.length > 5) {
                console.log('✅ DeepSeek response 100% finished and verified as new.');
                return verifiedText;
              }
            }
          }
          continue;
        }

        idleTicks++;
        if (idleTicks >= 75) {
          const err = new Error('NO_NEW_RESPONSE: DeepSeek response finished but content could not be captured.');
          err.code = 'NO_NEW_RESPONSE';
          throw err;
        }
      }
    } finally {
      this._baseline = null;
    }
  }
  async startNewChat() {
    if (!this.page || this.page.isClosed()) {
      throw new Error(this.t('unavailable'));
    }

    try {
      this._baseline = null;
      await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+j' : 'Control+j');
      await this.page.waitForTimeout(600);

      const isInputEmpty = await this.page.evaluate(() => {
        const input = document.querySelector('#chat-input, textarea');
        return input ? (input.value || '') === '' : false;
      });

      if (!isInputEmpty) {
        let clicked = false;
        const newChatLoc = this.page.locator('div[tabindex="0"], div[role="button"]').filter({ hasText: /new chat/i }).first();
        if (await newChatLoc.isVisible({ timeout: 500 }).catch(() => false)) {
          clicked = await this.humanClick(newChatLoc);
        }
        if (!clicked) {
          const plusLoc = this.page.locator('div[role="button"].ds-button--capsule, div.ds-button--icon-relative-m').first();
          if (await plusLoc.isVisible({ timeout: 500 }).catch(() => false)) {
            clicked = await this.humanClick(plusLoc);
          }
        }
        if (!clicked) {
          await this.page.goto('https://chat.deepseek.com/', { waitUntil: 'domcontentloaded' });
        }
      }

      await this.page.waitForSelector('#chat-input, textarea', { timeout: 8000 }).catch(() => {});
      await this.page.waitForTimeout(1000);
      return true;
    } catch (err) {
      console.error('Error starting new chat:', err.message);
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
      console.log('P DeepSeek tab parked (conversation DOM released).');
    } catch (e) {
      console.warn('parkTab warning:', e.message);
    }
  }

  
  async ensureOnChat(url) {
    if (!this.page || this.page.isClosed()) return;
    const target = (url && url.includes('/chat/')) ? url : 'https://chat.deepseek.com/';
    const current = this.page.url().split('?')[0].split('#')[0];
    const targetClean = target.split('?')[0].split('#')[0];
    if (current === targetClean) return;
    await this.page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await this.page.waitForTimeout(1200);
  }
  async checkChatExists(targetUrl) {
    
    if (!this.page || this.page.isClosed()) return true;
    
    if (!targetUrl) return false;
    if (!targetUrl.includes('/chat/')) return true;
    try {
      
      const normUrl = (u) => String(u || '').split('?')[0].split('#')[0].replace(/\/$/, '');
      if (normUrl(this.page.url()) !== normUrl(targetUrl)) {
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await this.page.waitForTimeout(1200);
      }
      const currentUrl = this.page.url();
      if (/\/sign_in|\/login/i.test(currentUrl)) {
        return true;
      }
      const normalized = currentUrl.replace(/\/$/, '').split('?')[0].split('#')[0];
      
      if (!normalized.includes('/chat/')) {
        return false;
      }
      
      
      
      const verdict = await this.page.evaluate(() => {
        const bodyText = document.body ? document.body.innerText.trim() : '';
        const hasErrorElement = !!document.querySelector(
          '[class*="not-found"], [class*="notFound"], [class*="error-page"], [class*="errorPage"], [class*="empty-page"]'
        );
        const hasMarker = /session does not exist|conversation not found|chat not found|page not found|404/i.test(bodyText);
        return { hasErrorElement, hasMarker, isShort: bodyText.length < 300 };
      });
      if (verdict.hasErrorElement) return false;
      if (verdict.hasMarker && verdict.isShort) return false;
      return true;
    } catch {
      
      return true;
    }
  }

  async getSidebarChatTitles() {
    if (!this.page || this.page.isClosed()) return [];
    try {
      return await this.page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('div[class*="_7b40dad"], div.dc1f7bee_4bcc731, div[class*="chat-item"]'));
        return items.map(el => (el.innerText || '').trim()).filter(Boolean);
      });
    } catch {
      return [];
    }
  }
}

module.exports = DeepSeekDriver;