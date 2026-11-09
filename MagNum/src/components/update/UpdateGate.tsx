import React, { useState, useEffect, useCallback } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { NethersLogo } from '../shared/NethersLogo';
import { RefreshCw, Download, HardDrive } from 'lucide-react';

type GateState = 'checking' | 'error' | 'available' | 'downloading' | 'installing' | 'uptodate';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '۰ بایت';
  const k = 1024;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const spin: React.CSSProperties = {
  width: 28, height: 28,
  border: '3px solid var(--border-subtle)',
  borderTopColor: 'var(--accent-green)',
  borderRadius: '50%',
  display: 'inline-block',
  animation: 'magnumSpin 0.8s linear infinite',
};

export const UpdateGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>('checking');
  const [update, setUpdate] = useState<Update | null>(null);
  const [currentVersion, setCurrentVersion] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ downloaded: 0, total: 0 });

  const doCheck = useCallback(async () => {
    setState('checking');
    setError('');
    try {
      const ver = await getVersion();
      setCurrentVersion(ver);
      const u = await check();
      if (u) {
        setUpdate(u);
        setState('available');
      } else {
        setState('uptodate');
      }
    } catch (err: any) {
      setError(err?.message || 'خطا در اتصال به سرور آپدیت');
      setState('error');
    }
  }, []);

  useEffect(() => { doCheck(); }, [doCheck]);

  const handleUpdate = async () => {
    if (!update) return;
    setState('downloading');
    setProgress({ downloaded: 0, total: 0 });
    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setProgress({ downloaded: 0, total: event.data.contentLength ?? 0 });
            break;
          case 'Progress':
            setProgress(prev => ({
              ...prev,
              downloaded: prev.downloaded + event.data.chunkLength,
            }));
            break;
          case 'Finished':
            setState('installing');
            break;
        }
      });
      await relaunch();
    } catch (err: any) {
      setError(err?.message || 'خطا در نصب آپدیت');
      setState('error');
    }
  };

  if (state === 'uptodate') return <>{children}</>;

  const pct = progress.total > 0
    ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
    : 0;

  return (
    <div style={{
      height: '100vh', width: '100vw',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', position: 'fixed', inset: 0, zIndex: 999999,
    }}>
      <div style={{
        position: 'absolute', width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-green-dim) 0%, transparent 65%)',
        opacity: 0.4, top: -120, right: -80, pointerEvents: 'none',
      }} />

      <div dir="rtl" style={{
        position: 'relative', width: 400, maxWidth: '92vw',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '32px 28px',
        boxShadow: '0 24px 60px var(--shadow-heavy)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 15,
          background: 'var(--accent-green-dim)', color: 'var(--accent-green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <NethersLogo size={32} title="MagNum" />
        </div>

        {state === 'checking' && (
          <>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>
              در حال بررسی آپدیت...
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              لطفاً صبر کنید — اتصال به سرور ندرز گیمز
            </span>
            <div style={spin} />
          </>
        )}

        {state === 'error' && (
          <>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--diff-del-text)' }}>
              خطا در بررسی آپدیت
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              {error}
            </span>
            <button
              onClick={doCheck}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--accent-green)', color: 'var(--on-accent)',
                border: 'none', borderRadius: 9, padding: '10px 28px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} /> تلاش مجدد
            </button>
          </>
        )}

        {state === 'available' && update && (
          <>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>
              نسخه جدید منتشر شد! 🎉
            </span>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 10, padding: '10px 16px', width: '100%',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {currentVersion}
              </span>
              <span style={{ color: 'var(--accent-green)', fontSize: 14 }}>←</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-green)' }}>
                {update.version}
              </span>
            </div>

            {update.body && (
              <div style={{
                width: '100%', maxHeight: 140, overflowY: 'auto',
                background: 'var(--bg-code)', border: '1px solid var(--border-subtle)',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.8,
                textAlign: 'right', whiteSpace: 'pre-wrap',
              }}>
                {update.body}
              </div>
            )}

            <button
              onClick={handleUpdate}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--accent-green)', color: 'var(--on-accent)',
                border: 'none', borderRadius: 9, padding: '12px 40px',
                fontSize: 14, fontWeight: 800, cursor: 'pointer', width: '100%',
                justifyContent: 'center',
              }}
            >
              <Download size={16} /> بروزرسانی
            </button>

            <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
              آپدیت اجباری است — بدون بروزرسانی امکان ادامه وجود ندارد
            </span>
          </>
        )}

        {state === 'downloading' && (
          <>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>
              در حال دانلود آپدیت...
            </span>

            {progress.total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <HardDrive size={13} />
                <span>{formatBytes(progress.downloaded)} از {formatBytes(progress.total)}</span>
                <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>({pct}%)</span>
              </div>
            )}

            <div style={{
              width: '100%', height: 8, borderRadius: 4,
              background: 'var(--bg-card)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: 'var(--accent-green)',
                width: `${pct}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>

            <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
              لطفاً برنامه را نبندید
            </span>
          </>
        )}

        {state === 'installing' && (
          <>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>
              در حال نصب آپدیت...
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              برنامه به‌زودی مجدداً راه‌اندازی می‌شود
            </span>
            <div style={spin} />
          </>
        )}
      </div>
    </div>
  );
};
