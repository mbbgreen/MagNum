import React, { useEffect, useRef, useState } from 'react';
import { Search, Plus, Folder, FolderOpen, Check, ChevronRight } from 'lucide-react';

interface RepoPickerMenuProps {
  open: boolean;
  onClose: () => void;
  recents: string[];
  activePath: string;
  isScratch: boolean;
  onSelect: (path: string) => void;
  onScratch: () => void;
  onOpenFolder: () => void;
  posStyle?: React.CSSProperties; 
}

export const isScratchPath = (p: string) => /[/\\]scratch[/\\]scratch-/i.test(p || '');
export const scratchLabel = 'Start from scratch';

export const RepoPickerMenu: React.FC<RepoPickerMenuProps> = ({
  open, onClose, recents, activePath, isScratch, onSelect, onScratch, onOpenFolder, posStyle
}) => {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  if (!open) return null;
  const list = recents.filter(p => p.toLowerCase().includes(q.toLowerCase()));
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-main)' };
  const label: React.CSSProperties = { fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 700, padding: '6px 10px 3px', letterSpacing: 0.3 };
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 300,
        background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', borderRadius: 10,
        boxShadow: '0 16px 40px var(--shadow-heavy)', padding: 6, zIndex: 4000,
        display: 'flex', flexDirection: 'column', ...(posStyle || {})
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 5 }}>
        <Search size={13} color="var(--text-dim)" />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search repos, cloud environments..."
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: 12 }} />
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        <div style={label}>Recents</div>
        <div className="hover-bright" style={row} onClick={() => { onScratch(); onClose(); }}>
          <Plus size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{scratchLabel}</span>
          {isScratch && <Check size={13} color="var(--accent-green)" style={{ flexShrink: 0 }} />}
        </div>
        {list.map(p => (
          <div key={p} className="hover-bright" style={row} onClick={() => { onSelect(p); onClose(); }} title={p}>
            <Folder size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.split(/[\\/]/).filter(Boolean).pop()}
            </span>
            {p === activePath && <Check size={13} color="var(--accent-green)" style={{ flexShrink: 0 }} />}
          </div>
        ))}
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '5px 0' }} />
        <div className="hover-bright" style={row} onClick={() => { onOpenFolder(); onClose(); }}>
          <FolderOpen size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Use Existing...</span>
          <ChevronRight size={13} color="var(--text-dim)" style={{ flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
};
