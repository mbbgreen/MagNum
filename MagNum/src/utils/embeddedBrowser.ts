import { Webview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';
import { invoke } from '@tauri-apps/api/core';

export interface EmbeddedRect { x: number; y: number; width: number; height: number; }

class EmbeddedBrowserManager {
  private webview: Webview | null = null;
  private creating: Promise<Webview> | null = null;
  public isVisible = false;
  private currentRect: EmbeddedRect = { x: 0, y: 0, width: 440, height: 600 };
  private activeUrl: string = 'https://www.google.com/?hl=fa';
  private resizeSuspended = false;
  private backendPort: number = 5454;

  public setPort(port: number): void {
    if (port > 0) this.backendPort = port;
  }

  private async getPort(): Promise<number> {
    if (this.backendPort === 5454) {
      try {
        const port = await invoke<number>('get_backend_port');
        if (port) this.backendPort = port;
      } catch {}
    }
    return this.backendPort;
  }

  async ensure(): Promise<Webview> {
    if (this.webview) return this.webview;

    // بازیابی رفرنس وب‌ویو در صورت وجود
    try {
      const existing = await Webview.getByLabel('magnum-embedded-browser');
      if (existing) {
        this.webview = existing;
        return existing;
      }
    } catch {}

    if (this.creating) return this.creating;

    this.creating = (async () => {
      const win = getCurrentWindow();
      const wv = new Webview(win, 'magnum-embedded-browser', {
        url: this.activeUrl,
        x: Math.max(0, Math.round(this.currentRect.x)),
        y: Math.max(0, Math.round(this.currentRect.y)),
        width: Math.max(10, Math.round(this.currentRect.width)),
        height: Math.max(10, Math.round(this.currentRect.height)),
        focus: false
      } as any);

      await new Promise<void>((resolve, reject) => {
        (wv as any).once('tauri://created', () => resolve()).catch(reject);
        (wv as any).once('tauri://error', (e: any) => reject(e)).catch(reject);
      });

      this.webview = wv;
      return wv;
    })();

    try {
      return await this.creating;
    } finally {
      this.creating = null;
    }
  }

  beginResize(): void {
    this.resizeSuspended = true;
    if (this.webview && this.isVisible) {
      this.webview.hide().catch(() => {});
      this.isVisible = false;
    }
  }

  endResize(): void {
    this.resizeSuspended = false;
  }

  async showIn(rect: EmbeddedRect): Promise<void> {
    this.currentRect = rect;
    if (this.resizeSuspended) return;

    const wv = await this.ensure();
    await wv.setPosition(new LogicalPosition(Math.max(0, Math.round(rect.x)), Math.max(0, Math.round(rect.y))));
    await wv.setSize(new LogicalSize(Math.max(10, Math.round(rect.width)), Math.max(10, Math.round(rect.height))));
    if (!this.isVisible) {
      await wv.show().catch(() => {});
      this.isVisible = true;
    }
  }

  async hide(): Promise<void> {
    this.isVisible = false;
    try {
      if (!this.webview) {
        const existing = await Webview.getByLabel('magnum-embedded-browser');
        if (existing) this.webview = existing;
      }
      if (this.webview) {
        await this.webview.hide().catch(() => {});
      }
    } catch (e) {
      console.warn('[embeddedBrowser] hide error:', e);
    }
  }

  buildUrl(input: string): string {
    let target = String(input || '').trim();
    if (!target) return '';
    if (!/^https?:\/\//i.test(target) && !target.startsWith('about:')) {
      if (target.includes('.') && !target.includes(' ')) target = 'https://' + target;
      else target = `https://www.google.com/search?q=${encodeURIComponent(target)}&hl=fa`;
    }
    return target;
  }

  async navigate(input: string): Promise<void> {
    const url = this.buildUrl(input);
    if (!url) return;
    this.activeUrl = url;

    // ۱. هدایت بدون پرش و مستقیم از طریق بک‌اند (CDP)
    const port = await this.getPort();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/browser-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'navigate', url: this.activeUrl })
      });
      const data = await res.json();
      if (data && data.ok) {
        return;
      }
    } catch {}

    // ۲. روش جایگزین: بازسازی و هدایت مستقیم وب‌ویو
    if (this.webview) {
      try {
        await this.webview.close();
      } catch {}
      this.webview = null;
    }

    const win = getCurrentWindow();
    const newWv = new Webview(win, 'magnum-embedded-browser', {
      url: this.activeUrl,
      x: Math.max(0, Math.round(this.currentRect.x)),
      y: Math.max(0, Math.round(this.currentRect.y)),
      width: Math.max(10, Math.round(this.currentRect.width)),
      height: Math.max(10, Math.round(this.currentRect.height)),
      focus: true
    } as any);

    await new Promise<void>((resolve, reject) => {
      (newWv as any).once('tauri://created', () => resolve()).catch(reject);
      (newWv as any).once('tauri://error', (e: any) => reject(e)).catch(reject);
    });

    if (this.isVisible) {
      await newWv.show().catch(() => {});
    }
    this.webview = newWv;
  }

  async back(): Promise<void> {
    const port = await this.getPort();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/browser-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'back' })
      });
      const data = await res.json();
      if (data && data.ok) return;
    } catch {}
    await this.navigate('https://www.google.com/?hl=fa');
  }

  async forward(): Promise<void> {
    const port = await this.getPort();
    try {
      await fetch(`http://127.0.0.1:${port}/api/browser-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'forward' })
      });
    } catch {}
  }

  async reload(): Promise<void> {
    const port = await this.getPort();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/browser-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reload' })
      });
      const data = await res.json();
      if (data && data.ok) return;
    } catch {}
    if (this.activeUrl) await this.navigate(this.activeUrl);
  }

  getActiveUrl(): string {
    return this.activeUrl;
  }

  getState() {
    return { u: this.activeUrl, t: 'Browser' };
  }

  async syncPageContent(): Promise<void> {
    const port = await this.getPort();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/browser-info`);
      const data = await res.json();
      if (data && data.url && data.url !== 'about:blank') {
        this.activeUrl = data.url;
      }
    } catch {}
  }
}

export const embeddedBrowser = new EmbeddedBrowserManager();
