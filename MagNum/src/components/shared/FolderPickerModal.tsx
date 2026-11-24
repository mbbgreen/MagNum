import React, { useCallback, useEffect, useState } from 'react';
import {
  Folder, HardDrive, ArrowUp, X, Loader2, AlertCircle, ChevronRight,
  Home, FileText, Download, Monitor, FolderOpen
} from 'lucide-react';
import { Language, translations } from '../../i18n/translations';

interface DirEntry { name: string; path: string; isDrive?: boolean; }
interface DirListing {
  path: string;
  parent: string | null;
  entries: DirEntry[];
  shortcuts?: { name: string; path: string }[];
  error?: string;
}

interface FolderPickerModalProps {
  open: boolean;
  notice?: string;
  onClose: () => void;
  onPick: (path: string) => void;
  browseDir: (path?: string) => Promise<DirListing>;
  lang?: Language;
}

const SHORTCUT_ICONS: Record<string, React.ReactNode> = {
  Home: <Home size={12} />,
  Desktop: <Monitor size={12} />,
  Documents: <FileText size={12} />,
  Downloads: <Download size={12} />
};

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  open, notice, onClose, onPick, browseDir, lang = 'en'
}) => {
  const [listing, setListing] = useState<DirListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const t = translations[lang];
  const isFa = lang === 'fa';

  const shortcutLabel = (name: string) =>
    name === 'Home' ? t.shortcutHome
    : name === 'Desktop' ? t.shortcutDesktop
    : name === 'Documents' ? t.shortcutDocuments
    : name === 'Downloads' ? t.shortcutDownloads
    : name;

  const navigate = useCallback(async (p?: string) => {
    setLoading(true);
    const res = await browseDir(p);
    setListing(res);
    setPathInput(res.path || '');
    setLoading(false);
  }, [browseDir]);

  useEffect(() => {
    if (!open) return;
    setListing(null);
    navigate('');
  }, [open, navigate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const atRoots = !listing?.path;
  const canOpen = Boolean(listing?.path && !listing?.error);
  const entries = listing?.entries || [];
  const shortcuts = listing?.shortcuts || [];

  const btn: React.CSSProperties = {
    background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)',
    borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 5, flexShrink: 0
  };

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <div
        dir={isFa ? 'rtl' : 'ltr'}
        style={{
          width: 560, maxWidth: '94vw', maxHeight: '86vh',
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 14, boxShadow: '0 24px 60px var(--shadow-heavy)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--accent-green-dim)', color: 'var(--accent-green)'
          }}>
            <FolderOpen size={15} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-main)' }}>{t.folderPickerTitle}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t.folderPickerSubtitle}</div>
          </div>
          <button onClick={onClose} style={{ ...btn, border: 'none' }} title={t.closeEscTip}><X size={15} /></button>
        </div>

        {notice && (
          <div dir="auto" style={{
            margin: '10px 16px 0', padding: '8px 12px', borderRadius: 8, flexShrink: 0,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)',
            color: 'var(--warn-text)', fontSize: 11.5, lineHeight: 1.7,
            display: 'flex', gap: 8, alignItems: 'flex-start'
          }}>
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{notice}</span>
          </div>
        )}

        {/* Path bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px 8px', flexShrink: 0 }}>
          <button
            onClick={() => navigate(listing?.parent ?? '')}
            disabled={loading}
            title={atRoots ? t.thisPcDrivesTip : t.upOneLevelTip}
            style={{ ...btn, opacity: loading ? 0.5 : 1 }}
          >
            <ArrowUp size={14} />
          </button>
          <button onClick={() => navigate('')} disabled={loading} title={t.thisPcDrivesTip} style={{ ...btn, opacity: loading ? 0.5 : 1 }}>
            <HardDrive size={14} />
          </button>
          <input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && pathInput.trim()) navigate(pathInput.trim()); }}
            placeholder={t.typePathPlaceholder}
            dir="ltr"
            className="code-font"
            style={{
              flex: 1, minWidth: 0, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 7, color: 'var(--text-main)', fontSize: 11.5, padding: '6px 10px', outline: 'none'
            }}
          />
        </div>

        {/* Shortcuts */}
        {shortcuts.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px', flexWrap: 'wrap', flexShrink: 0 }}>
            {shortcuts.map(s => (
              <button
                key={s.path}
                onClick={() => navigate(s.path)}
                className="hover-bright"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)', borderRadius: 999, padding: '3px 10px',
                  fontSize: 10.5, fontWeight: 600, cursor: 'pointer'
                }}
              >
                {SHORTCUT_ICONS[s.name] || <Folder size={12} />}
                {shortcutLabel(s.name)}
              </button>
            ))}
          </div>
        )}

        {/* Listing */}
        <div style={{ flex: 1, minHeight: 180, overflowY: 'auto', margin: '0 16px', border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'var(--bg-card)', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', zIndex: 2 }}>
              <Loader2 size={20} color="var(--accent-green)" style={{ animation: 'magnumSpin 1s linear infinite' }} />
            </div>
          )}
          {listing?.error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', color: 'var(--diff-del-text)', fontSize: 12 }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span className="code-font" dir="ltr" style={{ wordBreak: 'break-all' }}>{listing.error}</span>
            </div>
          )}
          {!loading && !listing?.error && entries.length === 0 && (
            <div style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
              {atRoots ? t.noDrivesDetected : t.noSubfolders}
            </div>
          )}
          {!loading && entries.map(e => (
            <div
              key={e.path}
              onClick={() => navigate(e.path)}
              className="hover-bright"
              title={e.path}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px',
                cursor: 'pointer', fontSize: 12.5, color: 'var(--text-main)',
                borderBottom: '1px solid var(--border-subtle)'
              }}
            >
              {e.isDrive
                ? <HardDrive size={14} color="var(--accent-green)" style={{ flexShrink: 0 }} />
                : <Folder size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
              <span className="code-font" dir="ltr" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.name}
              </span>
              <ChevronRight size={13} color="var(--text-dim)" style={{ flexShrink: 0, transform: isFa ? 'rotate(180deg)' : 'none' }} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', flexShrink: 0 }}>
          <span className="code-font" dir="ltr" style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {listing?.path || t.thisPc}
          </span>
          <button
            onClick={onClose}
            className="hover-bright"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {t.cancel}
          </button>
          <button
            onClick={() => canOpen && onPick(listing!.path)}
            disabled={!canOpen}
            className="hover-bright"
            style={{
              background: canOpen ? 'var(--accent-green)' : 'var(--bg-card)',
              color: canOpen ? 'var(--on-accent)' : 'var(--text-dim)',
              border: 'none', padding: '7px 18px', borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: canOpen ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <FolderOpen size={13} />
            {t.openThisFolder}
          </button>
        </div>
      </div>
    </div>
  );
};
