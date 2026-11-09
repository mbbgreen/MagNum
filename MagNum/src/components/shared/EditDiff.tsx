import React, { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { EditSummary, EditDetail } from '../../types';
import { groupEditSummaries, EditGroup } from '../../utils/diff';
import { AgentIcon } from '../../utils/agentIcons';

const MAX_RENDER_LINES = 400;

export const DiffView: React.FC<{ detail?: EditDetail; legacy?: boolean }> = ({ detail, legacy }) => {
  if (!detail) {
    if (legacy) return <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text-dim)' }}>Legacy edit — diff not stored.</div>;
    return <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text-dim)' }}>Loading diff…</div>;
  }
  const lines = detail.diff.slice(0, MAX_RENDER_LINES);
  return (
    <div className="code-font" style={{ fontSize: 11, lineHeight: 1.65, overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--bg-code)' }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', background: l.type === 'add' ? 'var(--diff-add)' : l.type === 'del' ? 'var(--diff-del)' : 'transparent', color: l.type === 'add' ? 'var(--diff-add-text)' : l.type === 'del' ? 'var(--diff-del-text)' : 'var(--text-muted)', padding: '0 8px' }}>
          <span style={{ width: 14, userSelect: 'none', flexShrink: 0 }}>{l.type === 'add' ? '+' : l.type === 'del' ? '-' : ''}</span>
          <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.text || ' '}</span>
        </div>
      ))}
      {detail.diff.length > MAX_RENDER_LINES && (
        <div style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--text-dim)' }}>… {detail.diff.length - MAX_RENDER_LINES} more lines hidden</div>
      )}
      {detail.truncated && <div style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--text-dim)' }}>Diff truncated at storage time.</div>}
    </div>
  );
};

interface RowProps {
  group: EditGroup;
  details: Record<number, EditDetail>;
  onRequestIds?: (ids: number[]) => void;
  label: string;
  editsWord?: string;
  defaultOpen?: boolean;
}
export const FileEditsRow: React.FC<RowProps> = memo(({ group, details, onRequestIds, label, editsWord = 'edits', defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && onRequestIds) {
      const missing = group.items.filter(it => it.id != null && !details[it.id]).map(it => it.id);
      if (missing.length) onRequestIds(missing);
    }
  };
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', margin: '6px 0' }}>
      <button onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', background: 'transparent', border: 'none', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-main)', fontSize: 12 }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <AgentIcon kind="patch" color="var(--accent-green)" />
        <span style={{ fontWeight: 600, flexShrink: 0 }}>{label}</span>
        <span className="code-font" style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.file}</span>
        {group.items.length > 1 && <span style={{ fontSize: 10.5, color: 'var(--text-dim)', flexShrink: 0 }}>{group.items.length} {editsWord}</span>}
        <span className="code-font" style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
          <span style={{ color: 'var(--diff-add-text)' }}>+{group.added}</span>
          <span style={{ color: 'var(--diff-del-text)' }}>-{group.deleted}</span>
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {group.items.map((it, i) => (
            <DiffView key={it.id ?? i} detail={it.id != null ? details[it.id] : undefined} legacy={it.id == null} />
          ))}
        </div>
      )}
    </div>
  );
});

export const EditSummaryRows: React.FC<{
  edits: EditSummary[];
  details: Record<number, EditDetail>;
  onRequestIds?: (ids: number[]) => void;
  label: string;
  editsWord?: string;
  defaultOpen?: boolean;
}> = memo(({ edits, details, onRequestIds, label, editsWord, defaultOpen }) => (
  <div>
    {groupEditSummaries(edits).map(g => (
      <FileEditsRow key={g.file} group={g} details={details} onRequestIds={onRequestIds} label={label} editsWord={editsWord} defaultOpen={defaultOpen} />
    ))}
  </div>
));
