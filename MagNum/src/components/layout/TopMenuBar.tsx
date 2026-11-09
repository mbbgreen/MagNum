import React, { useState, useEffect } from 'react';
import { GitBranch } from 'lucide-react';
import { alertDialog } from '../modals/AppDialog';

interface TopMenuBarProps {
  activeWorkspace: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onOpenFolder: () => void;
  onToggleTab: (tab: 'changes' | 'browser' | 'terminal' | 'files') => void;
  onOpenFilters: () => void;
  onDiagnose: () => void;
}

export const TopMenuBar: React.FC<TopMenuBarProps> = ({
  activeWorkspace,
  onToggleSidebar,
  onNewChat,
  onOpenFolder,
  onToggleTab,
  onOpenFilters,
  onDiagnose
}) => {
  const [openMenu, setOpenMenu] = useState<'file' | 'edit' | 'view' | 'help' | null>(null);

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
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            File
          </button>
          {openMenu === 'file' && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={onNewChat}>
                <span>New Agent</span> <span className="shortcut-text">Ctrl+N</span>
              </div>
              <div className="dropdown-item" onClick={onOpenFolder}>
                <span>Open Folder</span> <span className="shortcut-text">Ctrl+O</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => onToggleTab('terminal')}>
                <span>New Terminal</span> <span className="shortcut-text">Ctrl+Shift+'</span>
              </div>
              <div className="dropdown-item" onClick={() => onToggleTab('browser')}>
                <span>New Browser</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => window.close()}>
                <span>Exit</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'edit' ? null : 'edit'); }}
            style={{
              background: openMenu === 'edit' ? 'var(--bg-surface-hover)' : 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
          {openMenu === 'edit' && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={() => document.execCommand('undo')}>
                <span>Undo</span> <span className="shortcut-text">Ctrl+Z</span>
              </div>
              <div className="dropdown-item" onClick={() => document.execCommand('redo')}>
                <span>Redo</span> <span className="shortcut-text">Ctrl+Y</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => document.execCommand('cut')}>
                <span>Cut</span> <span className="shortcut-text">Ctrl+X</span>
              </div>
              <div className="dropdown-item" onClick={() => document.execCommand('copy')}>
                <span>Copy</span> <span className="shortcut-text">Ctrl+C</span>
              </div>
              <div className="dropdown-item" onClick={() => document.execCommand('paste')}>
                <span>Paste</span> <span className="shortcut-text">Ctrl+V</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'view' ? null : 'view'); }}
            style={{
              background: openMenu === 'view' ? 'var(--bg-surface-hover)' : 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            View
          </button>
          {openMenu === 'view' && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={onToggleSidebar}>
                <span>Toggle Primary Sidebar</span> <span className="shortcut-text">Ctrl+B</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => onToggleTab('changes')}>
                <span>Changes</span> <span className="shortcut-text">Ctrl+E</span>
              </div>
              <div className="dropdown-item" onClick={() => onToggleTab('browser')}>
                <span>Browser</span> <span className="shortcut-text">Ctrl+Shift+B</span>
              </div>
              <div className="dropdown-item" onClick={() => onToggleTab('files')}>
                <span>Files</span> <span className="shortcut-text">Ctrl+G</span>
              </div>
              <div className="dropdown-item" onClick={() => onToggleTab('terminal')}>
                <span>Terminal</span> <span className="shortcut-text">Ctrl+J</span>
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={onOpenFilters}>
                <span>Filter Settings</span> <span className="shortcut-text">Ctrl+,</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'help' ? null : 'help'); }}
            style={{
              background: openMenu === 'help' ? 'var(--bg-surface-hover)' : 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Help
          </button>
          {openMenu === 'help' && (
            <div className="dropdown-menu">
              <div className="dropdown-item" onClick={onDiagnose}>
                <span>Diagnose Engine</span> <span className="shortcut-text">Ctrl+K</span>
              </div>
              <div className="dropdown-item" onClick={() => alertDialog({ title: 'License', message: 'MagNum Agent v1.0.0 — All rights reserved.' })}>
                <span>View License</span>
              </div>
            </div>
          )}
        </div>

      </div>

<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
