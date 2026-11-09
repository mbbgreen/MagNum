import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  ArrowLeft, ArrowRight, RotateCw, Globe, Maximize2, Minimize2, Search,
  Diff, Terminal, FileText, Plus, PanelRight, Trash2,
  ChevronDown, ChevronRight, Check, RotateCcw, GitBranch, MoreHorizontal, X
} from 'lucide-react';
import { RightPanelTab, FileNode, EditSummary, EditDetail, ChatMessage, DiffLineData } from '../../types';
import { getFileLanguage } from '../../utils/language';
import { Language, translations } from '../../i18n/translations';
import { embeddedBrowser } from '../../utils/embeddedBrowser';

type PanelKey = Exclude<RightPanelTab, null>;

interface InspectorDrawerProps {
  tab: RightPanelTab;
  openTabs?: PanelKey[];
  onSelectTab: (tab: PanelKey) => void;
  onCloseTab: (tab: PanelKey) => void;
  onAddTab: (tab: PanelKey) => void;
  pendingPatches: EditSummary[];
  editDetails?: Record<number, EditDetail>;
  onRequestEditsIds?: (ids: number[]) => void;
  messages: ChatMessage[];
  revertedIds: number[];
  onRevertEdits: (ids: number[]) => void;
  fileTree: FileNode[];
  selectedFileName: string;
  selectedFileContent: string | null;
  agentStatus: string;
  isRunning: boolean;
  terminalLogs: { line: string; kind: string; ts: number }[];
  patchHistory: { file: string; success: boolean; message?: string; ts: number }[];
  onClose: () => void;
  onApprovePatch: () => void;
  onRejectPatch: () => void;
  pendingCommand: string | null;
  onApproveCommand: () => void;
  onRejectCommand: () => void;
  onOpenFile: (filename: string) => void;
  onOpenBrowser: () => void;
  lang?: Language;
  termLines: { type: 'out' | 'err' | 'echo' | 'sys'; text?: string; cwd?: string; command?: string }[];
  termCwd: string;
  onTerminalInput: (text: string) => void;
  onTerminalInterrupt: () => void;
  onTerminalRestart: () => void;
}

const PANEL_TABS: { key: PanelKey; label: string; icon: React.ReactNode }[] = [
  { key: 'changes', label: 'Changes', icon: <Diff size={12} /> },
  { key: 'browser', label: 'Browser', icon: <Globe size={12} /> },
  { key: 'terminal', label: 'powershell', icon: <Terminal size={12} /> },
  { key: 'files', label: 'Files', icon: <FileText size={12} /> }
];

const PANEL_MENU_ITEMS: { key: PanelKey; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { key: 'files', label: 'Files', icon: <FileText size={14} />, shortcut: 'Ctrl+G' },
  { key: 'terminal', label: 'powershell', icon: <Terminal size={14} />, shortcut: 'Ctrl+J' },
  { key: 'browser', label: 'Browser', icon: <Globe size={14} />, shortcut: 'Ctrl+Shift+B' },
  { key: 'changes', label: 'Changes', icon: <Diff size={14} />, shortcut: 'Ctrl+E' }
];


const PanelAddMenu: React.FC<{
  pos: { top: number; left: number };
  anchorRef: { current: HTMLElement | null };
  openTabs: PanelKey[];
  fileTree: FileNode[];
  onAddTab: (k: PanelKey) => void;
  onOpenFile: (rel: string) => void;
  onOpenUrl: (q: string) => void;
  onClose: () => void;
}> = ({ pos, anchorRef, openTabs, fileTree, onAddTab, onOpenFile, onOpenUrl, onClose }) => {
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current && boxRef.current.contains(t)) return;
      if (anchorRef.current && anchorRef.current.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose, anchorRef]);

  const q = query.trim().toLowerCase();
  const items = PANEL_MENU_ITEMS.filter(it => !q || it.label.toLowerCase().includes(q));
  const files = useMemo(() => {
    const out: string[] = [];
    const walk = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (n.isDir) { if (n.children) walk(n.children); } else out.push(n.relPath);
      }
    };
    walk(fileTree);
    return out;
  }, [fileTree]);
  const fileHits = q ? files.filter(f => f.toLowerCase().includes(q)).slice(0, 6) : [];
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-main)' };

  return (
    <div
      ref={boxRef}
      style={{
        position: 'fixed', top: pos.top, left: pos.left, width: 284,
        background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', borderRadius: 12,
        boxShadow: '0 18px 44px var(--shadow-heavy)', padding: 6, zIndex: 5000,
        display: 'flex', flexDirection: 'column', gap: 2
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
        <Search size={13} color="var(--text-dim)" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (fileHits.length > 0) { onOpenFile(fileHits[0]); onClose(); }
              else if (query.trim()) { onOpenUrl(query.trim()); onClose(); }
            }
          }}
          placeholder="Open any file, URL, or panel…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: 12 }}
        />
      </div>
      {items.map(it => (
        <div key={it.key} className="hover-bright" style={rowStyle} onClick={() => { onAddTab(it.key); onClose(); }}>
          <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{it.icon}</span>
          <span style={{ fontWeight: 600 }}>{it.label}</span>
          {openTabs.includes(it.key) && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>open</span>}
          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-dim)' }}>{it.shortcut}</span>
        </div>
      ))}
      {fileHits.length > 0 && (
        <>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
          {fileHits.map(f => (
            <div key={f} className="hover-bright" style={rowStyle} onClick={() => { onOpenFile(f); onClose(); }} title={f}>
              <FileText size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span className="code-font" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
            </div>
          ))}
        </>
      )}
      {q && (
        <>
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
          <div className="hover-bright" style={rowStyle} onClick={() => { onOpenUrl(query.trim()); onClose(); }}>
            <Globe size={13} color="var(--accent-green)" style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Search web for “{query.trim()}”</span>
          </div>
        </>
      )}
    </div>
  );
};

const FileTreeNode: React.FC<{ node: FileNode; depth: number; selected: string; onOpen: (rel: string) => void }> = ({ node, depth, selected, onOpen }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div
        onClick={() => (node.isDir ? setOpen(o => !o) : onOpen(node.relPath))}
        className="hover-bright"
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', paddingLeft: 6 + depth * 10, borderRadius: 4, cursor: 'pointer', fontSize: 11.5, color: selected === node.relPath ? 'var(--accent-green)' : 'var(--text-muted)', background: selected === node.relPath ? 'var(--accent-green-dim)' : 'transparent' }}
      >
        <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{node.isDir ? (open ? '▾' : '▸') : '•'}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      </div>
      {node.isDir && open && (node.children || []).map(c => (
        <FileTreeNode key={c.relPath} node={c} depth={depth + 1} selected={selected} onOpen={onOpen} />
      ))}
    </div>
  );
};

const navBtnStyle: React.CSSProperties = { background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: 4, borderRadius: 6, cursor: 'pointer', display: 'flex', flexShrink: 0 };


const BrowserPanel: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [addr, setAddr] = useState('');
  const [pageTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const addrFocused = useRef(false);

  const syncRect = useCallbackSafe(async () => {
    const el = hostRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    try {
      await embeddedBrowser.showIn({ x: r.left, y: r.top, width: r.width, height: r.height });
      setReady(true);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  });

  useEffect(() => {
    let ro: ResizeObserver | null = null;
    let alive = true;
    (async () => {
      await syncRect();
      if (!alive) return;
      if (hostRef.current && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => { syncRect(); });
        ro.observe(hostRef.current);
      }
    })();
    const onWinResize = () => syncRect();
    window.addEventListener('resize', onWinResize);
    return () => {
      alive = false;
      ro?.disconnect();
      window.removeEventListener('resize', onWinResize);
      embeddedBrowser.hide();
    };
  }, [syncRect]);

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const u = embeddedBrowser.getActiveUrl();
        if (u && !addrFocused.current) setAddr(u);
        embeddedBrowser.syncPageContent();
      } catch {}
    }, 1500);
    return () => clearInterval(iv);
  }, []);

  const submit = async () => {
    const v = addr.trim();
    if (!v) return;
    try {
      await embeddedBrowser.navigate(v);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <button className="hover-bright" onClick={() => embeddedBrowser.back()} title="Back" style={navBtnStyle}><ArrowLeft size={14} /></button>
        <button className="hover-bright" onClick={() => embeddedBrowser.forward()} title="Forward" style={navBtnStyle}><ArrowRight size={14} /></button>
        <button className="hover-bright" onClick={() => embeddedBrowser.reload()} title="Reload" style={navBtnStyle}><RotateCw size={13} /></button>
        <input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          onFocus={() => { addrFocused.current = true; }}
          onBlur={() => { addrFocused.current = false; }}
          onKeyDown={(e) => { if (e.key === 'Enter') { submit(); (e.target as HTMLInputElement).blur(); } }}
          placeholder="Search Google or type a URL..."
          style={{ flex: 1, minWidth: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-main)', fontSize: 12, padding: '5px 10px', outline: 'none' }}
        />
        <button className="hover-bright" onClick={submit} title="Go" style={navBtnStyle}><Search size={13} /></button>
      </div>
      {}
      {}
      <div ref={hostRef} style={{ flex: 1, position: 'relative', background: 'var(--bg-editor)', overflow: 'hidden', marginLeft: 6 }}>
        {!ready && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg-topbar)', color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: 20 }}>
            <Globe size={30} color="var(--accent-green)" />
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>MagNum Embedded Browser</span>
            <span style={{ fontSize: 11 }}>Launching native in-app webview…</span>
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg-topbar)', color: 'var(--diff-del-text)', fontSize: 12, textAlign: 'center', padding: 24 }}>
            <Globe size={28} color="var(--diff-del-text)" />
            <span style={{ fontWeight: 700 }}>Embedded webview failed to start</span>
            <span style={{ fontSize: 11, lineHeight: 1.7, maxWidth: 340 }}>{error}<br />Check Tauri capabilities (core:webview:allow-create-webview …) in src-tauri/capabilities/default.json</span>
          </div>
        )}
      </div>
      <div style={{ padding: '4px 10px', borderTop: '1px solid var(--border-subtle)', fontSize: 10.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
        {pageTitle || 'New Tab'}{addr && addr !== 'about:blank' ? ` — ${addr}` : ''}
      </div>
    </div>
  );
};


type ChangeScope = 'all' | 'last' | 'pending';
const SCOPE_LABELS: Record<ChangeScope, string> = {
  all: 'All Chat Changes',
  last: 'Last Agent Turn',
  pending: 'Pending Approval'
};
interface ChangeEditRef { id: number; file: string; added: number; deleted: number; }
interface DiffItem { kind: 'add' | 'del' | 'ctx'; text: string; num: number; }
type DiffSeg =
  | { type: 'lines'; items: DiffItem[] }
  | { type: 'fold'; count: number; key: string; items: DiffItem[] };

const extBadge = (file: string) => {
  const ext = file.split('.').pop() || '';
  return (ext.toUpperCase().slice(0, 3)) || 'TXT';
};

function numberDiff(diff: DiffLineData[]): DiffItem[] {
  const out: DiffItem[] = [];
  let n = 0;
  for (const l of diff) {
    n += 1;
    out.push({ kind: l.type, text: l.text, num: n });
  }
  return out;
}

function buildSegments(items: DiffItem[], fileKey: string, editId: number): DiffSeg[] {
  const GUARD = 3;
  const MIN_FOLD = 8;
  const segs: DiffSeg[] = [];
  let buf: DiffItem[] = [];
  let foldIdx = 0;
  const flush = () => { if (buf.length) { segs.push({ type: 'lines', items: buf }); buf = []; } };
  let i = 0;
  while (i < items.length) {
    if (items[i].kind !== 'ctx') { buf.push(items[i]); i++; continue; }
    let j = i;
    while (j < items.length && items[j].kind === 'ctx') j++;
    const run = j - i;
    if (run > MIN_FOLD) {
      const head = i > 0 ? GUARD : 0;
      const tail = j < items.length ? GUARD : 0;
      const foldStart = i + head;
      const foldEnd = j - tail;
      if (head) buf.push(...items.slice(i, foldStart));
      flush();
      segs.push({ type: 'fold', count: foldEnd - foldStart, key: `${fileKey}#${editId}#f${foldIdx++}`, items: items.slice(foldStart, foldEnd) });
      buf = items.slice(foldEnd, j);
    } else {
      buf.push(...items.slice(i, j));
    }
    i = j;
  }
  flush();
  return segs;
}

const ChangesPanel: React.FC<{
  messages: ChatMessage[];
  pendingPatches: EditSummary[];
  editDetails: Record<number, EditDetail>;
  onRequestEditsIds?: (ids: number[]) => void;
  revertedIds: number[];
  onRevertEdits: (ids: number[]) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
  pendingCommand: string | null;
  onApproveCommand: () => void;
  onRejectCommand: () => void;
  lang?: Language;
}> = ({
  messages, pendingPatches, editDetails, onRequestEditsIds, revertedIds, onRevertEdits, onApproveAll, onRejectAll,
  pendingCommand, onApproveCommand, onRejectCommand, lang = 'en'
}) => {
  const t = translations[lang] || translations.en;
  const [scope, setScope] = useState<ChangeScope>('all');
  const [scopeMenu, setScopeMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [foldMode, setFoldMode] = useState<'auto' | 'open' | 'closed'>('auto');
  const [openFolds, setOpenFolds] = useState<Record<string, boolean>>({});
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  
  const [openFiles, setOpenFiles] = useState<Record<string, boolean>>({});
  const isFileOpen = (f: string) => Boolean(openFiles[f]);
  const toggleFile = (f: string) => setOpenFiles(prev => ({ ...prev, [f]: !prev[f] }));
  const scopeRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const revertedSet = useMemo(() => new Set(revertedIds), [revertedIds]);

  const { allEdits, lastEdits } = useMemo(() => {
    const all: ChangeEditRef[] = [];
    let last: ChangeEditRef[] = [];
    messages.forEach(m => {
      const refs = (m.edits || [])
        .filter(e => e.id != null)
        .map(e => ({ id: e.id as number, file: e.file, added: e.added || 0, deleted: e.deleted || 0 }));
      if (refs.length) { all.push(...refs); last = refs; }
    });
    return { allEdits: all, lastEdits: last };
  }, [messages]);

  const liveAll = useMemo(() => allEdits.filter(e => !revertedSet.has(e.id)), [allEdits, revertedSet]);
  const liveLast = useMemo(() => lastEdits.filter(e => !revertedSet.has(e.id)), [lastEdits, revertedSet]);
  const pendingRefs = useMemo<ChangeEditRef[]>(
    () => pendingPatches.filter(p => p.id != null).map(p => ({ id: p.id as number, file: p.file, added: p.added || 0, deleted: p.deleted || 0 })),
    [pendingPatches]
  );
  const scopeEdits = scope === 'pending' ? pendingRefs : scope === 'last' ? liveLast : liveAll;

  useEffect(() => {
    const missing = scopeEdits.filter(e => !editDetails[e.id]).map(e => e.id);
    if (missing.length && onRequestEditsIds) onRequestEditsIds(missing);
  }, [scope, scopeEdits, editDetails, onRequestEditsIds]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeMenu(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const totals = (list: ChangeEditRef[]) => list.reduce((acc, e) => ({ a: acc.a + e.added, d: acc.d + e.deleted }), { a: 0, d: 0 });
  const tAll = totals(liveAll);
  const tLast = totals(liveLast);
  const tPend = totals(pendingRefs);
  const tScope = totals(scopeEdits);
  const filesIn = (list: ChangeEditRef[]) => Array.from(new Set(list.map(e => e.file)));

  const fileGroups = useMemo(() => {
    const map = new Map<string, ChangeEditRef[]>();
    for (const e of scopeEdits) {
      if (!map.has(e.file)) map.set(e.file, []);
      map.get(e.file)!.push(e);
    }
    return Array.from(map.entries());
  }, [scopeEdits]);

  const isFoldOpen = (key: string) => (foldMode === 'open' ? true : foldMode === 'closed' ? false : !!openFolds[key]);

  const lineRow = (it: DiffItem, key: string | number) => (
    <div key={key} style={{
      display: 'flex',
      background: it.kind === 'add' ? 'var(--diff-add)' : it.kind === 'del' ? 'var(--diff-del)' : 'transparent',
      borderLeft: it.kind === 'add' ? '3px solid var(--accent-green)' : it.kind === 'del' ? '3px solid var(--diff-del-text)' : '3px solid transparent'
    }}>
      <span style={{ width: 44, flexShrink: 0, textAlign: 'right', padding: '0 8px 0 0', color: 'var(--text-dim)', fontSize: 10.5, userSelect: 'none' }}>{it.num}</span>
      <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '0 8px 0 4px', color: it.kind === 'add' ? 'var(--diff-add-text)' : it.kind === 'del' ? 'var(--diff-del-text)' : 'var(--text-muted)' }}>{it.text || ' '}</span>
    </div>
  );

  const scopeIcon = (s: ChangeScope) =>
    s === 'all' ? <FileText size={12} /> : s === 'last' ? <Diff size={12} /> : <RotateCw size={12} />;

  const scopeItem = (s: ChangeScope, label: string, t: { a: number; d: number }) => (
    <div key={s} onClick={() => { setScope(s); setScopeMenu(false); }} className="hover-bright" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-main)' }}>
      <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{scopeIcon(s)}</span>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
        <span className="code-font" style={{ fontSize: 10.5, color: 'var(--diff-add-text)' }}>+{t.a}</span>
        {t.d > 0 && <span className="code-font" style={{ fontSize: 10.5, color: 'var(--diff-del-text)' }}>-{t.d}</span>}
        {scope === s && <Check size={12} color="var(--accent-green)" />}
      </span>
    </div>
  );

  const summaryRow = (label: string, count: number, t: { a: number; d: number }, target: ChangeScope) => (
    <div key={label} onClick={() => setScope(target)} className="hover-bright" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
      <FileText size={13} color="var(--text-dim)" />
      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{count} {label}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <span className="code-font" style={{ color: 'var(--diff-add-text)', fontSize: 11 }}>+{t.a}</span>
        {t.d > 0 && <span className="code-font" style={{ color: 'var(--diff-del-text)', fontSize: 11 }}>-{t.d}</span>}
      </span>
    </div>
  );

  const menuBox: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, marginTop: 6,
    background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', borderRadius: 10,
    boxShadow: '0 12px 30px var(--shadow-heavy)', padding: 5, zIndex: 1200,
    display: 'flex', flexDirection: 'column', gap: 2
  };
  const menuItem: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-main)' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }} ref={scopeRef}>
          <button onClick={() => setScopeMenu(v => !v)} className="hover-bright" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 7, color: 'var(--text-main)', fontSize: 11.5, padding: '4px 8px', cursor: 'pointer' }}>
            {scopeIcon(scope)}
            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{SCOPE_LABELS[scope]}</span>
            <span className="code-font" style={{ fontSize: 10.5, color: 'var(--diff-add-text)' }}>+{tScope.a}</span>
            {tScope.d > 0 && <span className="code-font" style={{ fontSize: 10.5, color: 'var(--diff-del-text)' }}>-{tScope.d}</span>}
            <ChevronDown size={11} color="var(--text-dim)" />
          </button>
          {scopeMenu && (
            <div style={{ ...menuBox, width: 230 }}>
              {scopeItem('last', 'Last Agent Turn', tLast)}
              {scopeItem('all', 'All Chat Changes', tAll)}
              {scopeItem('pending', 'Pending Approval', tPend)}
            </div>
          )}
        </div>
        <span title="Git integration is not connected yet" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 7, padding: '4px 8px', opacity: 0.65, flexShrink: 0 }}>
          <GitBranch size={11} /> main
        </span>
        <div style={{ position: 'relative' }} ref={moreRef}>
          <button onClick={() => setMoreMenu(v => !v)} className="hover-bright" title="View options" style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 6 }}>
            <MoreHorizontal size={14} />
          </button>
          {moreMenu && (
            <div style={{ ...menuBox, width: 180 }}>
              <div className="hover-bright" style={menuItem} onClick={() => { setFoldMode('open'); setMoreMenu(false); }}>Expand all hunks</div>
              <div className="hover-bright" style={menuItem} onClick={() => { setFoldMode('closed'); setMoreMenu(false); }}>Collapse all hunks</div>
              <div className="hover-bright" style={menuItem} onClick={() => { setFoldMode('auto'); setOpenFolds({}); setMoreMenu(false); }}>Auto fold (default)</div>
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {pendingRefs.length > 0 && (
          <button onClick={onRejectAll} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--diff-del-text)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, flexShrink: 0 }}>
            Reject All
          </button>
        )}
        {selectedFiles.length > 0 ? (
          <button
            onClick={() => {
              const ids = scopeEdits.filter(e => selectedFiles.includes(e.file)).map(e => e.id);
              onRevertEdits(ids);
              setSelectedFiles([]);
            }}
            style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}
          >
            Revert Selected ({selectedFiles.length})
          </button>
        ) : pendingRefs.length > 0 ? (
          <button onClick={onApproveAll} style={{ background: 'var(--accent-green)', border: 'none', color: 'var(--on-accent)', padding: '4px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
            Approve All
          </button>
        ) : (
          <button disabled style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)', padding: '4px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'default', flexShrink: 0 }}>
            No pending changes
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {}
        {pendingCommand && (
          <div style={{
            margin: '12px 10px',
            padding: '12px 14px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={14} color="var(--warn-text)" />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--warn-text)' }}>
                {t.commandPendingLabel}
              </span>
            </div>
            <code className="code-font selectable-text" dir="ltr" style={{
              fontSize: 12,
              background: 'var(--bg-code)',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              wordBreak: 'break-all',
              lineHeight: 1.6
            }}>
              $ {pendingCommand}
            </code>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onApproveCommand}
                style={{
                  flex: 1,
                  background: 'var(--accent-green)',
                  color: 'var(--on-accent)',
                  border: 'none',
                  borderRadius: 7,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Check size={13} /> Execute
              </button>
              <button
                onClick={onRejectCommand}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: 'var(--diff-del-text)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 7,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <X size={13} /> Reject
              </button>
            </div>
          </div>
        )}

        {fileGroups.length === 0 ? (
          <div style={{ padding: '18px 12px' }}>
            <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', marginBottom: 14 }}>
              {scope === 'pending' ? 'No pending changes waiting for approval.' : scope === 'last' ? 'No edits in the last agent turn.' : 'No changes applied in this chat yet.'}
            </div>
            {summaryRow('Files Changed', filesIn(liveAll).length, tAll, 'all')}
            {summaryRow('Last Agent Turn', filesIn(liveLast).length, tLast, 'last')}
            {summaryRow('Pending Approval', filesIn(pendingRefs).length, tPend, 'pending')}
          </div>
        ) : (
          fileGroups.map(([file, edits]) => {
            const added = edits.reduce((s, e) => s + e.added, 0);
            const deleted = edits.reduce((s, e) => s + e.deleted, 0);
            const ids = edits.map(e => e.id);
            const isSel = selectedFiles.includes(file);
            const isOpen = isFileOpen(file);
            return (
              <div key={file} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div
                  onClick={() => toggleFile(file)}
                  className="hover-bright"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                >
                  {isOpen ? <ChevronDown size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />}
                  <span className="code-font" style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--warn-text)', background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.25)', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>{extBadge(file)}</span>
                  <span className="code-font selectable-text" style={{ fontSize: 11.5, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</span>
                  <span className="code-font" style={{ fontSize: 11, color: 'var(--diff-add-text)', flexShrink: 0 }}>+{added}</span>
                  {deleted > 0 && <span className="code-font" style={{ fontSize: 11, color: 'var(--diff-del-text)', flexShrink: 0 }}>-{deleted}</span>}
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {scope !== 'pending' && (
                      <>
                        <button title="Revert changes in this file" className="hover-bright" onClick={(e) => { e.stopPropagation(); onRevertEdits(ids); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 3, borderRadius: 5 }}>
                          <RotateCcw size={12} />
                        </button>
                        <input
                          type="checkbox"
                          title="Select for bulk revert"
                          checked={isSel}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => setSelectedFiles(prev => (isSel ? prev.filter(f => f !== file) : [...prev, file]))}
                          style={{ width: 13, height: 13, accentColor: 'var(--accent-green)', cursor: 'pointer' }}
                        />
                      </>
                    )}
                  </span>
                </div>
                {isOpen && edits.map(e => {
                  const d = editDetails[e.id];
                  if (!d) return <div key={e.id} style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-dim)' }}>Loading diff…</div>;
                  const segs = buildSegments(numberDiff(d.diff), file, e.id);
                  return (
                    <div key={e.id} className="code-font selectable-text" style={{ fontSize: 11, lineHeight: 1.6 }}>
                      {segs.map((seg, si) =>
                        seg.type === 'fold' ? (
                          isFoldOpen(seg.key) ? (
                            <div key={seg.key}>{seg.items.map((it, ii) => lineRow(it, ii))}</div>
                          ) : (
                            <button
                              key={seg.key}
                              onClick={() => setOpenFolds(prev => ({ ...prev, [seg.key]: true }))}
                              title="Expand hidden lines"
                              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'var(--bg-surface)', border: 'none', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: 10.5, padding: '3px 10px', cursor: 'pointer' }}
                            >
                              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 0.7 }}>
                                <ChevronDown size={9} style={{ transform: 'rotate(180deg)' }} />
                                <ChevronDown size={9} />
                              </span>
                              <span>{seg.count} unmodified lines</span>
                            </button>
                          )
                        ) : (
                          <div key={si}>{seg.items.map((it, ii) => lineRow(it, ii))}</div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};


function useCallbackSafe<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef<T>(fn);
  ref.current = fn;
  return React.useCallback(((...args: any[]) => ref.current(...args)) as T, []);
}


interface TermLine { type: 'out' | 'err' | 'echo' | 'sys'; text?: string; cwd?: string; command?: string; }
const termLineColor = (text: string): string => {
  if (/^Mode\s+LastWriteTime/i.test(text)) return 'var(--term-head)';
  if (/^-{4,}(\s+-{4,})+\s*$/.test(text)) return 'var(--term-head)';
  if (/^d[-a-z]{2,}-/i.test(text)) return 'var(--term-dir)';
  return 'var(--text-main)';
};
const termIconBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 5 };
const TermPrompt: React.FC<{ cwd: string; command?: string; caret?: boolean }> = ({ cwd, command, caret }) => (
  <span>
    <span style={{ color: 'var(--term-prompt)', fontWeight: 600 }}>PS {cwd}&gt; </span>
    <span style={{ color: 'var(--term-cmd)' }}>{command ?? ''}</span>
    {caret && <span className="term-block-caret" />}
  </span>
);
const LiveTerminalPanel: React.FC<{
  lines: TermLine[];
  cwd: string;
  onInput: (t: string) => void;
  onInterrupt: () => void;
  onRestart: () => void;
}> = ({ lines, cwd, onInput, onInterrupt, onRestart }) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const focusTerminal = () => {
    scrollRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      focusTerminal();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, input]);
  const submit = () => {
    onInput(input);
    if (input.trim()) setHistory(prev => [...prev.slice(-99), input]);
    setHistIdx(-1);
    setInput('');
  };
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
    if (e.key === 'c' && e.ctrlKey) { e.preventDefault(); onInterrupt(); setInput(''); return; }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); onInput('cls'); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length) { const idx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1); setHistIdx(idx); setInput(history[idx]); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx !== -1) { const idx = histIdx + 1; if (idx >= history.length) { setHistIdx(-1); setInput(''); } else { setHistIdx(idx); setInput(history[idx]); } }
      return;
    }
    if (e.key === 'Backspace') { e.preventDefault(); setInput(p => p.slice(0, -1)); return; }
    if (e.key === 'Escape') { setInput(''); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setInput(p => p + e.key); }
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const t = e.clipboardData.getData('text').replace(/\r?\n/g, ' ');
    setInput(p => p + t);
  };
  return (
    <div
      onClick={focusTerminal}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-editor)', cursor: 'text' }}
    >
      <div style={{ height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, minWidth: 0 }}>
          <Terminal size={12} style={{ flexShrink: 0, color: 'var(--accent-green)' }} /> powershell
          <span className="code-font" dir="ltr" style={{ color: 'var(--text-dim)', fontWeight: 400, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cwd}</span>
        </span>
        <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="hover-bright" title="Clear (cls)" onClick={(e) => { e.stopPropagation(); onInput('cls'); focusTerminal(); }} style={termIconBtn}><Trash2 size={12} /></button>
          <button className="hover-bright" title="Restart shell" onClick={(e) => { e.stopPropagation(); onRestart(); focusTerminal(); }} style={termIconBtn}><RotateCw size={12} /></button>
        </span>
      </div>
      <div
        ref={scrollRef}
        tabIndex={0}
        autoFocus
        onKeyDown={handleKey}
        onPaste={handlePaste}
        className="code-font selectable-text"
        style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', fontSize: 12, lineHeight: 1.7, outline: 'none', cursor: 'text' }}
      >
        {lines.map((l, i) => {
          if (l.type === 'echo') return <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><TermPrompt cwd={l.cwd || ''} command={l.command} /></div>;
          if (l.type === 'sys') return <div key={i} style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>{l.text}</div>;
          return <div key={i} style={{ color: l.type === 'err' ? 'var(--diff-del-text)' : termLineColor(l.text || ''), whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.text || ' '}</div>;
        })}
        <div style={{ whiteSpace: 'pre-wrap' }}><TermPrompt cwd={cwd} command={input} caret /></div>
      </div>
    </div>
  );
};

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  tab, openTabs = [], onSelectTab, onCloseTab, onAddTab,
  pendingPatches, editDetails = {}, onRequestEditsIds, messages, revertedIds, onRevertEdits, fileTree, selectedFileName, selectedFileContent,
  onClose, onApprovePatch, onRejectPatch, onOpenFile,
  pendingCommand, onApproveCommand, onRejectCommand, lang = 'en',
  termLines, termCwd, onTerminalInput, onTerminalInterrupt, onTerminalRestart
}) => {
  const [width, setWidth] = useState(440);
  const [addMenuPos, setAddMenuPos] = useState<{ top: number; left: number } | null>(null);
  const plusBtnRef = useRef<HTMLButtonElement>(null);

  
  
  
  
  
  useEffect(() => {
    if (addMenuPos) {
      embeddedBrowser.beginResize(); 
    } else {
      embeddedBrowser.endResize();
      window.dispatchEvent(new Event('resize')); 
    }
  }, [addMenuPos]);

  

  useEffect(() => {
    if (tab === 'changes' && pendingPatches.length && onRequestEditsIds) {
      const missing = pendingPatches.filter(p => p.id != null && !editDetails[p.id]).map(p => p.id);
      if (missing.length) onRequestEditsIds(missing);
    }
  }, [tab, pendingPatches, editDetails, onRequestEditsIds]);

  
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    embeddedBrowser.beginResize();
    const onMove = (ev: MouseEvent) => {
      const w = window.innerWidth - ev.clientX;
      setWidth(Math.min(Math.max(w, 380), Math.round(window.innerWidth * 0.85)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      embeddedBrowser.endResize();
      window.dispatchEvent(new Event('resize')); 
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  
  
  
  
  useEffect(() => {
    if (tab !== 'browser') {
      embeddedBrowser.hide();
    }
  }, [tab]);

  if (!tab) return null;
  const tabs: PanelKey[] = openTabs.includes(tab) ? openTabs : [...openTabs, tab];

  return (
    <aside style={{
      width,
      minWidth: width,
      borderLeft: '1px solid var(--border-subtle)',
      background: 'var(--bg-topbar)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div onMouseDown={startDrag} title="Drag to resize" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize', zIndex: 10 }} />

      {}
      <div style={{ height: 40, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 0 10px', flexShrink: 0, gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {tabs.map(k => {
            const def = PANEL_TABS.find(p => p.key === k)!;
            const active = k === tab;
            return (
              <div
                key={k}
                onClick={() => onSelectTab(k)}
                className="hover-bright"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px', borderRadius: 7, cursor: 'pointer',
                  fontSize: 11.5, fontWeight: active ? 700 : 500,
                  color: active ? 'var(--text-main)' : 'var(--text-muted)',
                  background: active ? 'var(--bg-surface-hover)' : 'transparent',
                  border: `1px solid ${active ? 'var(--border-subtle)' : 'transparent'}`,
                  flexShrink: 0, maxWidth: 150
                }}
              >
                {def.icon}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.label}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); onCloseTab(k); }}
                  title="Close tab"
                  style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: 10, padding: '1px 2px', display: 'flex', flexShrink: 0 }}
                >✕</span>
              </div>
            );
          })}
          <button
            ref={plusBtnRef}
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setAddMenuPos(cur => (cur ? null : { top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 4, window.innerWidth - 292)) }));
            }}
            title="Open panel, file, or URL"
            className="hover-bright"
            style={{
              background: addMenuPos ? 'var(--bg-surface-hover)' : 'transparent',
              border: 'none',
              color: addMenuPos ? 'var(--text-main)' : 'var(--text-dim)',
              cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 6, flexShrink: 0
            }}
          >
            <Plus size={13} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setWidth(w => w > 500 ? 440 : Math.round(window.innerWidth * 0.62))}
            title={width > 500 ? 'Restore panel width' : 'Expand panel (Cursor style)'}
            className="hover-bright"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 2 }}
          >
            {width > 500 ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button onClick={onClose} title="Collapse panel" className="hover-bright" style={{ background: 'transparent', border: 'none', color: 'var(--accent-green)', cursor: 'pointer', display: 'flex', padding: 2 }}>
            <PanelRight size={13} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'changes' && (
          <ChangesPanel
            messages={messages}
            pendingPatches={pendingPatches}
            editDetails={editDetails}
            onRequestEditsIds={onRequestEditsIds}
            revertedIds={revertedIds}
            onRevertEdits={onRevertEdits}
            onApproveAll={onApprovePatch}
            onRejectAll={onRejectPatch}
            pendingCommand={pendingCommand}
            onApproveCommand={onApproveCommand}
            onRejectCommand={onRejectCommand}
            lang={lang}
          />
        )}
        {tab === 'browser' && <BrowserPanel />}
        {tab === 'terminal' && (
          <LiveTerminalPanel lines={termLines} cwd={termCwd} onInput={onTerminalInput} onInterrupt={onTerminalInterrupt} onRestart={onTerminalRestart} />
        )}
        {tab === 'files' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: 190, minWidth: 190, borderRight: '1px solid var(--border-subtle)', overflowY: 'auto', padding: '6px 4px' }}>
              {fileTree.map(n => (
                <FileTreeNode key={n.relPath} node={n} depth={0} selected={selectedFileName} onOpen={onOpenFile} />
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <Editor
                height="100%"
                theme="vs-dark"
                path={selectedFileName}
                language={getFileLanguage(selectedFileName)}
                value={selectedFileContent || '// Click a file to inspect'}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, fontFamily: "'JetBrains Mono', Consolas, monospace", scrollBeyondLastLine: false, automaticLayout: true }}
              />
            </div>
          </div>
        )}
      </div>

      {addMenuPos && (
        <PanelAddMenu
          pos={addMenuPos}
          anchorRef={plusBtnRef}
          openTabs={openTabs}
          fileTree={fileTree}
          onAddTab={onAddTab}
          onOpenFile={onOpenFile}
          onOpenUrl={(q) => { onAddTab('browser'); embeddedBrowser.navigate(q); }}
          onClose={() => setAddMenuPos(null)}
        />
      )}
    </aside>
  );
};
