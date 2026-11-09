import { Webview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';

export interface EmbeddedRect { x: number; y: number; width: number; height: number; }

class EmbeddedBrowserManager {
  private webview: Webview | null = null;
  private creating: Promise<Webview> | null = null;
  public isVisible = false;
  private currentRect: EmbeddedRect = { x: 0, y: 0, width: 440, height: 600 };
  private activeUrl: string = 'https://www.google.com/?hl=en';
  
  
  private resizeSuspended = false;

  async ensure(): Promise<Webview> {
    if (this.webview) return this.webview;
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
    if (this.webview && this.isVisible) {
      await this.webview.hide().catch(() => {});
      this.isVisible = false;
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
    await this.navigate('https://www.google.com/?hl=en');
  }
  async forward(): Promise<void> {}
  async reload(): Promise<void> {
    if (this.activeUrl) await this.navigate(this.activeUrl);
  }
  getActiveUrl(): string {
    return this.activeUrl;
  }
  getState() {
    return { u: this.activeUrl, t: 'Browser' };
  }
  syncPageContent(): void {
    
  }
}

export const embeddedBrowser = new EmbeddedBrowserManager();
