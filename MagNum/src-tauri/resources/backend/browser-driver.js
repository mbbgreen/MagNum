'use strict';

class DeepSeekDriver {
  constructor(page) {
    this.page = page;
    this.isAborted = false;
  }

  abort() {
    this.isAborted = true;
    this.clickStopButton().catch(() => {});
  }

  
  async humanClick(target) {
    if (!this.page || this.page.isClosed()) return false;
    try {
      let box = null;
      let locator = null;

      if (typeof target === 'string') {
        locator = this.page.locator(target).last();
        box = await locator.boundingBox({ timeout: 2000 }).catch(() => null);
      } else if (target && typeof target.boundingBox === 'function') {
        locator = target;
        box = await locator.boundingBox({ timeout: 2000 }).catch(() => null);
      }

      if (!box || box.width <= 0 || box.height <= 0) return false;

      
      const offsetX = box.width * (0.25 + Math.random() * 0.5);
      const offsetY = box.height * (0.25 + Math.random() * 0.5);
      const clickX = box.x + offsetX;
      const clickY = box.y + offsetY;

      
      const steps = Math.floor(Math.random() * 4) + 3;
      await this.page.mouse.move(clickX, clickY, { steps });

      
      await this.page.waitForTimeout(Math.floor(Math.random() * 40) + 30);

      
      await this.page.mouse.down();
      await this.page.waitForTimeout(Math.floor(Math.random() * 50) + 40);
      await this.page.mouse.up();

      return true;
    } catch {
      return false;
    }
  }

  async clickStopButton() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      return await this.page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const stop = btns.find(b => {
          const svg = b.querySelector('svg');
          return svg && (svg.querySelector('rect') || (svg.innerHTML || '').includes('<rect')) &&
            !b.hasAttribute('disabled') && b.getBoundingClientRect().width > 10;
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

  
  async clickRetryButton() {
    if (!this.page || this.page.isClosed()) return false;
    try {
      return await this.page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const retry = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
          const txt = (b.innerText || '').trim().toLowerCase();
          return /retry|try again/.test(label) || txt === 'retry' || txt === 'try again';
        });
        if (retry) { retry.click(); return true; }
        return false;
      });
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
      const fileInput = await this.page.locator('input[type="file"]').first();
      if (await fileInput.count() > 0) {
        console.log(`📤 Uploading ${filePaths.length} file(s) to DeepSeek Web...`);
        await fileInput.setInputFiles(filePaths);
        await this.page.waitForTimeout(3000);
      }
    } catch (err) {
      console.warn('⚠️ File upload warning:', err.message);
    }
  }

  
  async sendMessage(text, options = {}) {
    if (!this.page || this.page.isClosed()) throw new Error('مرورگر دیپ‌سیک بسته است.');
    if (typeof options.deepThink === 'boolean') await this.setDeepThink(options.deepThink);

    const input = await this.findInputElement();
    if (!input) throw new Error('فیلد ورودی چت دیپ‌سیک یافت نشد.');

    await input.focus();
    await this.page.waitForTimeout(100);

    const fullText = String(text);

    
    try {
      const CHUNK = 3000;
      for (let i = 0; i < fullText.length; i += CHUNK) {
        await this.page.keyboard.insertText(fullText.slice(i, i + CHUNK));
        if (i + CHUNK < fullText.length) await this.page.waitForTimeout(25);
      }
    } catch (e) {}

    
    let isWritten = await this.page.evaluate((expectedLen) => {
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
        if (setter) setter.call(el, content); else el.value = content;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, fullText);
      await this.page.waitForTimeout(200);
    }

    await this.page.waitForTimeout(300);

    
    let isSent = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
      const sendBtn = buttons.reverse().find(b => {
        const cls = (b.className || '').toString();
        const isPrimary = cls.includes('ds-button--primary');
        const isCircle = cls.includes('ds-button--circle');
        const isDisabled = cls.includes('ds-button--disabled') || b.getAttribute('aria-disabled') === 'true';
        return isPrimary && isCircle && !isDisabled;
      });
      if (sendBtn) {
        sendBtn.click();
        return true;
      }
      return false;
    });

    if (!isSent) {
      const sendLocator = this.page.locator('div[role="button"].ds-button--primary.ds-button--circle:not([disabled]):not(.ds-button--disabled)').last();
      if (await sendLocator.isVisible({ timeout: 500 }).catch(() => false)) {
        await sendLocator.click({ force: true }).catch(() => {});
        isSent = true;
      }
    }

    if (!isSent) {
      await input.focus();
      await this.page.keyboard.press('Enter');
    }

    await this.page.waitForTimeout(400);

    
    const stillHasContent = await this.page.evaluate(() => {
      const el = document.querySelector('#chat-input, textarea');
      return el && (el.value || el.innerText || '').trim().length > 5;
    });

    if (stillHasContent) {
      await input.focus();
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(300);
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

        
        let isThinkingInProgress = false;
        const leaves = Array.from(document.querySelectorAll('span, div, p')).filter(el => el.children.length === 0);
        const thinkHeader = leaves.reverse().find(el => {
          const t = (el.textContent || '').trim();
          return t === 'Thinking' || /^Thought for\b/.test(t);
        });

        if (thinkHeader) {
          isThinkingInProgress = /^Thinking/.test((thinkHeader.textContent || '').trim());
        }

        
        let isStopButtonActive = false;
        for (const b of document.querySelectorAll('button, div[role="button"]')) {
          if (!visible(b) || b.hasAttribute('disabled')) continue;
          const svg = b.querySelector('svg');
          if (svg && (svg.querySelector('rect') || (svg.innerHTML || '').includes('<rect'))) {
            isStopButtonActive = true;
            break;
          }
        }

        
        const userSelectors = ['[class*="user-message"]', '[class*="UserMessage"]', '[data-message-author-role="user"]', '[data-role="user"]'];
        const userEls = Array.from(document.querySelectorAll(userSelectors.join(',')));
        const lastUserEl = userEls.length ? userEls[userEls.length - 1] : null;
        const afterLastUser = (el) =>
          !lastUserEl ||
          el === lastUserEl ||
          (lastUserEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        const inThink = (el) => !!el.closest('[class*="think-content"], [class*="thinking"]');
        const afterThink = (el) => !thinkHeader || (thinkHeader.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        const notUser = (el) => !el.closest(userSelectors.join(','));

        const inputEl = document.querySelector('#chat-input, textarea, [contenteditable="true"]');
        const beforeInput = (el) => {
          if (!inputEl) return true;
          return (inputEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
        };

        const MD_SEL = 'p[class*="ds-markdown"], [class*="ds-markdown-paragraph"], pre, [class*="code-block"]';
        const allNodes = Array.from(document.querySelectorAll(MD_SEL)).filter(el => !inThink(el) && afterThink(el) && notUser(el) && afterLastUser(el) && beforeInput(el) && visible(el));
        const nodes = allNodes.filter(el => !allNodes.some(o => o !== el && o.contains(el)));
        let bodyText = nodes.map(n => (n.innerText || n.textContent || '').trim()).filter(Boolean).join('\n');

        if (!bodyText) {
          const codeBlocks = Array.from(document.querySelectorAll('pre, code, [class*="code-block"]'))
            .filter(el => visible(el) && afterLastUser(el) && beforeInput(el) && !inThink(el));
          const lastCode = codeBlocks[codeBlocks.length - 1];
          if (lastCode) {
            const codeText = (lastCode.innerText || '').trim();
            if (codeText.length > 5) bodyText = codeText;
          }
        }

        if (!bodyText) {
          const responseSelectors = ['[class*="chat-turn"]', '[class*="message-row"]', '[class*="chat-message"]', '[data-message-author-role="assistant"]', '[role="article"]'];
          const responseContainers = Array.from(document.querySelectorAll(responseSelectors.join(',')))
            .filter(el => visible(el) && afterLastUser(el) && beforeInput(el) && !inThink(el));
          const lastResponse = responseContainers[responseContainers.length - 1];
          if (lastResponse) {
            const respText = (lastResponse.innerText || '').trim();
            if (respText.length > 5) bodyText = respText;
          }
        }

        
        if (!bodyText) {
          bodyText = (document.body.innerText || '').trim();
        }

        const hasBottomActions = Array.from(document.querySelectorAll('button[aria-label*="copy" i], button[aria-label*="good response" i]'))
          .some(b => visible(b) && afterLastUser(b));
        const hasContinueBtn = Array.from(document.querySelectorAll('div[role="button"], button'))
          .some(b => (b.innerText || '').trim() === 'Continue' && afterLastUser(b));

        
        let hasActiveCaptcha = false;
        const isInputReady = inputEl && !inputEl.hasAttribute('disabled') && inputEl.offsetParent !== null;

        const modalEl = document.querySelector('[role="dialog"], .ds-modal, .ds-dialog, .ds-modal-mask, [class*="modal-overlay"]');
        const isModalVisible = modalEl && (() => {
          const s = window.getComputedStyle(modalEl);
          return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
        })();

        if (!isInputReady || isModalVisible) {
          for (const f of Array.from(document.querySelectorAll('iframe'))) {
            const src = (f.getAttribute('src') || '').toLowerCase();
            const title = (f.getAttribute('title') || '').toLowerCase();
            if (src.includes('hcaptcha.com') || src.includes('challenges.cloudflare.com') || title.includes('hcaptcha')) {
              const rect = f.getBoundingClientRect();
              if (rect.width > 120 && rect.height > 120 && visible(f) && f.offsetParent !== null) {
                hasActiveCaptcha = true;
                break;
              }
            }
          }
        }

        return {
          bodyText,
          isThinkingInProgress,
          isStopButtonActive,
          hasBottomActions,
          hasContinueBtn,
          hasActiveCaptcha
        };
      });
    } catch {
      return null;
    }
  }

  
  async waitForCompletion(onProgress, onStatus = null) {
    this.isAborted = false;
    let lastBodyLength = 0;
    let stableChecks = 0;
    let idleTicks = 0;
    let waitLoops = 0;
    let sawRunning = false;
    
    // ثبت وضعیت اولیه قبل از دریافت پاسخ جدید
    const initialState = await this.extractLiveState();
    const initialText = (initialState && typeof initialState.bodyText === 'string') 
      ? initialState.bodyText.trim() 
      : '';

    // فرصت کوتاه برای ثبت پیام کاربر در DOM دیپ‌سیک
    await this.page.waitForTimeout(1000);

    while (true) {
      if (this.isAborted) throw new Error('Task was cancelled by user.');
      if (!this.page || this.page.isClosed()) throw new Error('DeepSeek browser window was closed.');

      await this.page.waitForTimeout(800);
      waitLoops++;
      const state = await this.extractLiveState();
      if (!state) continue;

      if (state.hasActiveCaptcha) {
        const err = new Error('CAPTCHA_REQUIRED');
        err.code = 'CAPTCHA_REQUIRED';
        throw err;
      }

      // در حال فکر کردن دیپ‌سیک
      if (state.isThinkingInProgress) {
        sawRunning = true;
        stableChecks = 0;
        idleTicks = 0;
        if (typeof onStatus === 'function') onStatus('DeepSeek is thinking...');
        continue;
      }

      // دکمه توقف نشان‌دهنده در حال نوشتن بودن است
      if (state.isStopButtonActive) {
        sawRunning = true;
        stableChecks = 0;
        idleTicks = 0;
        if (typeof onStatus === 'function') onStatus('DeepSeek is writing...');
        continue;
      }

      // کلیک خودکار روی دکمه Continue در صورت بریده شدن متن
      if (state.hasContinueBtn && !state.isStopButtonActive) {
        sawRunning = true;
        await this.clickContinueButton();
        await this.page.waitForTimeout(1500);
        stableChecks = 0;
        idleTicks = 0;
        continue;
      }

      const rawText = (state.bodyText || '').trim();
      // ✂️ حذف پیشوند پاسخ قبلی: اگر اسکوپ DOM بشکند، متن به‌صورت
      // «قدیم + جدید» می‌آید؛ فقط بخش جدید را نگه دار
      const stripStale = (t) => {
        if (!initialText || t === initialText) return '';
        if (t.startsWith(initialText)) return t.slice(initialText.length).trim();
        return t;
      };
      const currentText = stripStale(rawText);

      if (rawText.length > 5) {
        const isStrictlyNew = currentText.length > 0;

        if (!isStrictlyNew) {
          // اگر متن هنوز همان متن نوبت قبل است، هرگز آن را نپذیر
          if (waitLoops > 60 && !sawRunning) {
            const err = new Error('NO_NEW_RESPONSE: DeepSeek never started a new reply for this turn.');
            err.code = 'NO_NEW_RESPONSE';
            throw err;
          }
          if (typeof onStatus === 'function') onStatus('DeepSeek is preparing response...');
          continue;
        }

        // اگر متن جدید آمده است، ثبات طول آن را بسنج
        if (currentText.length === lastBodyLength) {
          stableChecks++;
        } else {
          lastBodyLength = currentText.length;
          stableChecks = 0;
          if (onProgress) onProgress({ text: currentText });
        }

        // پایان واقعی پاسخ: متن جدید آمده، تغییر نکرده و نشانه‌های پایان چت ظاهر شده‌اند
        if (stableChecks >= 3 || (state.hasBottomActions && stableChecks >= 2)) {
          await this.page.waitForTimeout(1000);
          const verifyState = await this.extractLiveState();
          
          if (verifyState && !verifyState.isStopButtonActive && !verifyState.isThinkingInProgress) {
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
      if (idleTicks >= 40) {
        const err = new Error('NO_NEW_RESPONSE: DeepSeek response finished but content could not be captured.');
        err.code = 'NO_NEW_RESPONSE';
        throw err;
      }
    }
  }
  async startNewChat() {
    if (!this.page || this.page.isClosed()) {
      throw new Error('مرورگر دیپ‌سیک در دسترس نیست.');
    }

    try {
      await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+j' : 'Control+j');
      await this.page.waitForTimeout(600);

      const isInputEmpty = await this.page.evaluate(() => {
        const input = document.querySelector('#chat-input, textarea');
        return input ? (input.value || '') === '' : false;
      });

      if (!isInputEmpty) {
        const clicked = await this.page.evaluate(() => {
          const newChatBtn = Array.from(document.querySelectorAll('div[tabindex="0"], div[role="button"]'))
            .find(el => (el.innerText || '').toLowerCase().includes('new chat'));

          if (newChatBtn) {
            newChatBtn.click();
            return true;
          }

          const plusBtn = document.querySelector('div[role="button"].ds-button--capsule, div.ds-button--icon-relative-m');
          if (plusBtn) {
            plusBtn.click();
            return true;
          }
          return false;
        });

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
      
      if (this.page.url() !== targetUrl) {
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await this.page.waitForTimeout(1200);
      }
      const normalized = this.page.url().replace(/\/$/, '').split('?')[0].split('#')[0];
      
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