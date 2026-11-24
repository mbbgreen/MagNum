import React, { useMemo, useRef, useState } from 'react';
import {
  Plus, Sliders, FolderOpen, Folder, FolderPlus, Settings, Search,
  PanelLeftClose, ArrowLeft, ArrowRight, Home, ChevronRight, ChevronDown
} from 'lucide-react';
import { SessionMeta } from '../../types';
import { formatRelativeTime } from '../../utils/time';
import { stripSkillPrefix } from '../../utils/skills';
import { Language, translations } from '../../i18n/translations';
import { NethersLogo } from '../shared/NethersLogo';
import { RepoPickerMenu, isScratchPath } from '../shared/RepoPicker';

interface LeftSidebarProps {
  activeWorkspace: string;
  sessions: SessionMeta[];
  currentSessionId: string | null;
  recentWorkspaces: string[];
  onNewChat: () => void;
  onOpenFolder: () => void;
  onBrowseInApp?: () => void;
  onOpenWorkspace: (path: string) => void;
  onStartScratch: () => void;
  onOpenFilters: () => void;
  onLoadSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onDiagnose: () => void;
  onToggleSidebar: () => void;
  lang?: Language;
}

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--text-dim)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 4, borderRadius: 6, cursor: 'pointer'
};
const navBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, background: 'transparent',
  border: 'none', color: 'var(--text-muted)', padding: '6px 8px',
  borderRadius: 6, fontSize: 12.5, cursor: 'pointer', width: '100%', textAlign: 'start'
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  activeWorkspace, sessions, currentSessionId, recentWorkspaces,
  onNewChat, onOpenFolder, onBrowseInApp, onOpenWorkspace, onStartScratch, onOpenFilters,
  onLoadSession, onDeleteSession, onDiagnose, onToggleSidebar, lang = 'en'
}) => {
  const t = translations[lang];
  const isFa = lang === 'fa';
  const textDir = isFa ? 'rtl' : 'ltr';

  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number } | null>(null);
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('magnum_sidebar_width'));
    return Number.isFinite(saved) && saved >= 200 && saved <= 520 ? saved : 264;
  });
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => setWidth(Math.min(Math.max(ev.clientX, 200), 520));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setWidth(w => { localStorage.setItem('magnum_sidebar_width', String(w)); return w; });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const [collapsedRepos, setCollapsedRepos] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('magnum_collapsed_repos');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const toggleRepo = (key: string) => {
    setCollapsedRepos(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('magnum_collapsed_repos', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const groups = useMemo(() => {
    const map = new Map<string, SessionMeta[]>();
    for (const s of sessions) {
      const key = s.workspacePath || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    const list = Array.from(map.entries()).map(([key, items]) => ({ key, items }));
    const recency = (g: { items: SessionMeta[] }) => Math.max(...g.items.map(s => Date.parse(s.updatedAt) || 0), 0);
    list.sort((a, b) => {
      if (a.key === activeWorkspace) return -1;
      if (b.key === activeWorkspace) return 1;
      return recency(b) - recency(a);
    });
    return list;
  }, [sessions, activeWorkspace]);

  const openPopover = () => {
    const r = addBtnRef.current?.getBoundingClientRect();
    if (r) setPopoverAnchor({ top: r.bottom + 8, left: Math.max(8, r.left - 8) });
  };

  return (
    <aside style={{
      width, minWidth: width, background: 'var(--bg-primary)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative'
    }}>
      <div onMouseDown={startResize} title={t.dragToResize} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize', zIndex: 10 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 8px 4px' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="hover-bright" onClick={onToggleSidebar} style={{ ...iconBtn, color: 'var(--accent-green)' }} title={`${t.toggleSidebarTip} (Ctrl+B)`}><PanelLeftClose size={15} /></button>
            <button className="hover-bright" style={iconBtn} title={t.searchChatsTip}><Search size={14} /></button>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button style={{ ...iconBtn, opacity: 0.45, cursor: 'default' }}><ArrowLeft size={14} /></button>
            <button style={{ ...iconBtn, opacity: 0.45, cursor: 'default' }}><ArrowRight size={14} /></button>
          </div>
        </div>

        <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }} dir={textDir}>
          <button onClick={onNewChat} className="hover-bright" style={{ ...navBtn, color: 'var(--text-main)', fontWeight: 600 }}>
            <Plus size={14} color="var(--accent-green)" /> {t.newChat}
          </button>
        </div>

        <div style={{ padding: '12px 8px 0' }} dir={textDir}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 4px' }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: isFa ? 0 : 0.4 }}>{t.repositories}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button className="hover-bright" onClick={onOpenFilters} style={iconBtn} title={t.filtersTip}><Sliders size={12} /></button>
              <button ref={addBtnRef} className="hover-bright" onClick={openPopover} style={iconBtn} title={t.addRepoTip}>
                <FolderPlus size={13} />
              </button>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 8px' }}>{t.noChatsRecorded}</div>
          ) : (
            groups.map(g => {
              const folderKey = g.key || '__none__';
              const name = g.key ? g.key.split(/[\\/]/).filter(Boolean).pop() || g.key : t.noRepo;
              const isActive = g.key === activeWorkspace;
              const isCollapsed = Boolean(collapsedRepos[folderKey]);
              return (
                <div key={folderKey} style={{ marginBottom: 4 }}>
                  <div
                    onClick={() => toggleRepo(folderKey)}
                    className="hover-bright"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '5px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                      color: isActive ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 600,
                      userSelect: 'none', transition: 'background 0.15s ease'
                    }}
                    title={g.key || t.chatsWithoutRepo}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {isCollapsed ? <ChevronRight size={12} style={{ transform: isFa ? 'rotate(180deg)' : 'none' }} /> : <ChevronDown size={12} />}
                      </span>
                      {g.key ? (
                        isCollapsed
                          ? <Folder size={13} color={isActive ? 'var(--accent-green)' : 'var(--text-dim)'} style={{ flexShrink: 0 }} />
                          : <FolderOpen size={13} color={isActive ? 'var(--accent-green)' : 'var(--text-dim)'} style={{ flexShrink: 0 }} />
                      ) : (
                        <Home size={13} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                      )}
                      <span dir="auto" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 10, flexShrink: 0, marginInlineStart: 4 }}>
                      {g.items.length}
                    </span>
                  </div>
                  {!isCollapsed && (
                  <div style={{ paddingInlineStart: 14, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {g.items.map(s => (
                      <div
                        key={s.id}
                        onClick={() => onLoadSession(s.id)}
                        className="session-row hover-bright"
                        style={{
                          padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
                          background: currentSessionId === s.id ? 'var(--accent-green-dim)' : 'transparent',
                          color: currentSessionId === s.id ? 'var(--accent-green)' : 'var(--text-muted)',
                          fontSize: 12, display: 'flex', alignItems: 'center', gap: 6
                        }}
                      >
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', opacity: 0.6, flexShrink: 0 }} />
                        <span dir="auto" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{stripSkillPrefix(s.title)}</span>
                        <button
                          className="session-del"
                          onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10, padding: '0 2px', display: 'flex' }}
                        >✕</button>
                        <span style={{ fontSize: 10.5, color: 'var(--text-dim)', flexShrink: 0 }}>{formatRelativeTime(s.updatedAt, lang)}</span>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            className="hover-bright"
            onClick={() => {
              import('@tauri-apps/plugin-opener')
                .then(m => m.openUrl('https://nethersgames.com'))
                .catch(() => window.open('https://nethersgames.com', '_blank'));
            }}
            title={t.nethersTitle}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', padding: '2px 4px', borderRadius: 8
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'var(--accent-green-dim)', color: 'var(--accent-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <NethersLogo size={14} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)' }}>
              NethersGames
            </span>
          </div>
          <button onClick={onDiagnose} className="hover-bright" style={iconBtn}><Settings size={15} /></button>
        </div>
      </div>

      <RepoPickerMenu
        open={Boolean(popoverAnchor)}
        posStyle={{ position: 'fixed', top: popoverAnchor?.top ?? 0, left: popoverAnchor?.left ?? 0 }}
        onClose={() => setPopoverAnchor(null)}
        recents={recentWorkspaces}
        activePath={activeWorkspace}
        isScratch={isScratchPath(activeWorkspace)}
        onSelect={onOpenWorkspace}
        onScratch={onStartScratch}
        onOpenFolder={onOpenFolder}
        onBrowseInApp={onBrowseInApp}
        lang={lang}
      />
    </aside>
  );
};
