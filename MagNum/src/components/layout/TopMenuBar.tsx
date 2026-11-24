import React, { useState, useEffect } from 'react';
import { GitBranch, Heart } from 'lucide-react';
import { alertDialog } from '../modals/AppDialog';
import { Language, translations } from '../../i18n/translations';

interface TopMenuBarProps {
  activeWorkspace: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onOpenFolder: () => void;
  onToggleTab: (tab: 'changes' | 'browser' | 'terminal' | 'files') => void;
  onOpenFilters: () => void;
  onDiagnose: () => void;
  lang?: Language;
}

export const TopMenuBar: React.FC<TopMenuBarProps> = ({
  activeWorkspace,
  onToggleSidebar,
  onNewChat,
  onOpenFolder,
  onToggleTab,
  onOpenFilters,
  onDiagnose,
  lang = 'en'
}) => {
  const [openMenu, setOpenMenu] = useState<'file' | 'edit' | 'view' | 'help' | null>(null);
  const t = translations[lang];
  const isFa = lang === 'fa';
  const menuDir = isFa ? 'rtl' : 'ltr';

  useEffect(() => {
    const handleOutsideClick = () => setOpenMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const repoName = activeWorkspace ? activeWorkspace.split(/[\\/]/).filter(Boolean).pop() || activeWorkspace : '';

  return (
    <nav style={{
      height: '34px',
      background: 'var(--bg-topbar)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 10px',
      zIndex: 500,
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <img
          src="/logo.png"
          alt="MagNum"
          width={22}
          height={22}
          draggable={false}
          style={{ marginRight: 6, borderRadius: 5, objectFit: 'contain' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />

        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'file' ? null : 'file'); }}
            style={{
              background: openMenu === 'file' ? 'var(--bg-surface-hover)' : 'transparent',
              border: 'none', color: 'var(--text-main)', fontSize: '12px',
              padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            {t.menuFile}
          </button>
          {openMenu === 'file' && (
            <div className="dropdown-menu" dir={menuDir}>
              <div className="dropdown-item" onClick={onNewChat}>
                <span>{t.newAgent}</span> <span className="shortcut-text" dir="ltr">Ctrl+N</span>
              </div>
              <div className="dropdown-item" onClick={onOpenFolder}>
                <span>{t.openFolder}</span> <span className="shortcut-text" dir="ltr">Ctrl+O</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => onToggleTab('terminal')}>
                <span>{t.newTerminal}</span> <span className="shortcut-text" dir="ltr">Ctrl+Shift+'</span>
              </div>
              <div className="dropdown-item" onClick={() => onToggleTab('browser')}>
                <span>{t.newBrowser}</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => window.close()}>
                <span>{t.exitApp}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'edit' ? null : 'edit'); }}
            style={{
              background: openMenu === 'edit' ? 'var(--bg-surface-hover)' : 'transparent',
              border: 'none', color: 'var(--text-main)', fontSize: '12px',
              padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            {t.menuEdit}
          </button>
          {openMenu === 'edit' && (
            <div className="dropdown-menu" dir={menuDir}>
              <div className="dropdown-item" onClick={() => document.execCommand('undo')}>
                <span>{t.undo}</span> <span className="shortcut-text" dir="ltr">Ctrl+Z</span>
              </div>
              <div className="dropdown-item" onClick={() => document.execCommand('redo')}>
                <span>{t.redo}</span> <span className="shortcut-text" dir="ltr">Ctrl+Y</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => document.execCommand('cut')}>
                <span>{t.cut}</span> <span className="shortcut-text" dir="ltr">Ctrl+X</span>
              </div>
              <div className="dropdown-item" onClick={() => document.execCommand('copy')}>
                <span>{t.copy}</span> <span className="shortcut-text" dir="ltr">Ctrl+C</span>
              </div>
              <div className="dropdown-item" onClick={() => document.execCommand('paste')}>
                <span>{t.paste}</span> <span className="shortcut-text" dir="ltr">Ctrl+V</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'view' ? null : 'view'); }}
            style={{
              background: openMenu === 'view' ? 'var(--bg-surface-hover)' : 'transparent',
              border: 'none', color: 'var(--text-main)', fontSize: '12px',
              padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            {t.menuView}
          </button>
          {openMenu === 'view' && (
            <div className="dropdown-menu" dir={menuDir}>
              <div className="dropdown-item" onClick={onToggleSidebar}>
                <span>{t.toggleSidebarMenu}</span> <span className="shortcut-text" dir="ltr">Ctrl+B</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => onToggleTab('changes')}>
                <span>{t.tabChanges}</span> <span className="shortcut-text" dir="ltr">Ctrl+E</span>
              </div>
              <div className="dropdown-item" onClick={() => onToggleTab('browser')}>
                <span>{t.tabBrowser}</span> <span className="shortcut-text" dir="ltr">Ctrl+Shift+B</span>
              </div>
              <div className="dropdown-item" onClick={() => onToggleTab('files')}>
                <span>{t.tabFiles}</span> <span className="shortcut-text" dir="ltr">Ctrl+G</span>
              </div>
              <div className="dropdown-item" onClick={() => onToggleTab('terminal')}>
                <span>{t.tabTerminal}</span> <span className="shortcut-text" dir="ltr">Ctrl+J</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={onOpenFilters}>
                <span>{t.filterSettings}</span> <span className="shortcut-text" dir="ltr">Ctrl+,</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'help' ? null : 'help'); }}
            style={{
              background: openMenu === 'help' ? 'var(--bg-surface-hover)' : 'transparent',
              border: 'none', color: 'var(--text-main)', fontSize: '12px',
              padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            {t.menuHelp}
          </button>
          {openMenu === 'help' && (
            <div className="dropdown-menu" dir={menuDir}>
              <div className="dropdown-item" onClick={onDiagnose}>
                <span>{t.checkConnection}</span> <span className="shortcut-text" dir="ltr">Ctrl+K</span>
              </div>
              <div className="dropdown-item" onClick={() => alertDialog({ title: t.viewLicense, message: t.licenseMessage })}>
                <span>{t.viewLicense}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const url = 'https://nethersgames.com/donate';
            try {
              const w = window.open(url, '_blank', 'noopener,noreferrer');
              if (!w) {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                a.remove();
              }
            } catch {
              window.location.href = url;
            }
          }}
          title={t.donateTitle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: '#4ade80',
            background: 'linear-gradient(180deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))',
            border: '1px solid rgba(34,197,94,0.45)',
            borderRadius: 6,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 0 12px rgba(34,197,94,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
            transition: 'all 0.18s ease',
            lineHeight: 1
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(180deg, rgba(34,197,94,0.28), rgba(34,197,94,0.14))';
            e.currentTarget.style.boxShadow = '0 0 18px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(180deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(34,197,94,0.18), inset 0 1px 0 rgba(255,255,255,0.08)';
          }}
        >
          <Heart size={11} fill="#4ade80" color="#4ade80" />
          <span>{t.donate}</span>
        </button>

        {repoName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <GitBranch size={12} color="var(--accent-green)" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {repoName}
            </span>
          </div>
        )}
      </div>
    </nav>
  );
};
