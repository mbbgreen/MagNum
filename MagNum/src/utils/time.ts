import { Language } from '../i18n/translations';

export function formatRelativeTime(input?: number | string, lang: Language = 'en'): string {
  let ms: number | null = null;
  if (typeof input === 'number') ms = input;
  else if (typeof input === 'string' && input) {
    const t = Date.parse(input);
    if (!isNaN(t)) ms = t;
  }
  if (ms == null) return '';
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (lang === 'fa') {
    if (m < 1) return 'الان';
    if (m < 60) return `\u200F${m}\u200F د`;
    const h = Math.floor(m / 60);
    if (h < 24) return `\u200F${h}\u200F س`;
    const d = Math.floor(h / 24);
    if (d < 30) return `\u200F${d}\u200F ر`;
    return `\u200F${Math.floor(d / 30)}\u200F م`;
  }
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

export function formatRelativeAgo(ts?: number, lang: Language = 'en'): string {
  if (!ts) return '';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (lang === 'fa') {
    if (m < 1) return 'هم‌اکنون';
    if (m < 60) return `\u200F${m}\u200F دقیقه پیش`;
    const h = Math.floor(m / 60);
    if (h < 24) return `\u200F${h}\u200F ساعت پیش`;
    const d = Math.floor(h / 24);
    return `\u200F${d}\u200F روز پیش`;
  }
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatDuration(totalSec: number, lang: Language = 'en'): string {
  if (lang === 'fa') {
    if (totalSec < 60) return `\u200F${totalSec}\u200F ثانیه`;
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m < 60) return `\u200F${m}\u200F دقیقه و \u200F${s}\u200F ثانیه`;
    const h = Math.floor(m / 60);
    return `\u200F${h}\u200F ساعت و \u200F${m % 60}\u200F دقیقه`;
  }
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
