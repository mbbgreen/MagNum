import React, { memo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { EditSummary, EditDetail } from '../../types';
import { groupEditSummaries, EditGroup } from '../../utils/diff';
import { AgentIcon } from '../../utils/agentIcons';
import { Language, translations } from '../../i18n/translations';

const MAX_RENDER_LINES = 400;

export const DiffView: React.FC<{ detail?: EditDetail; legacy?: boolean; lang?: Language }> = ({ detail, legacy, lang = 'en' }) => {
  const t = translations[lang];
  if (!detail) {
    if (legacy) return <div dir={lang === 'fa' ? 'rtl' : 'ltr'} style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text-dim)' }}>{t.legacyEditNotStored}</div>;
    return <div dir={lang === 'fa' ? 'rtl' : 'ltr'} style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text-dim)' }}>{t.loadingDiff}</div>;
  }
  const lines = detail.diff.slice(0, MAX_RENDER_LINES);
  return (
    <div dir="ltr" className="code-font" style={{ fontSize: 11, lineHeight: 1.65, overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--bg-code)' }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', background: l.type === 'add' ? 'var(--diff-add)' : l.type === 'del' ? 'var(--diff-del)' : 'transparent', color: l.type === 'add' ? 'var(--diff-add-text)' : l.type === 'del' ? 'var(--diff-del-text)' : 'var(--text-muted)', padding: '0 8px' }}>
          <span style={{ width: 14, userSelect: 'none', flexShrink: 0 }}>{l.type === 'add' ? '+' : l.type === 'del' ? '-' : ''}</span>
          <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.text || ' '}</span>
        </div>
      ))}
      {detail.diff.length > MAX_RENDER_LINES && (
        <div dir={lang === 'fa' ? 'rtl' : 'ltr'} style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--text-dim)' }}>{t.moreLinesHidden(detail.diff.length - MAX_RENDER_LINES)}</div>
      )}
      {detail.truncated && <div dir={lang === 'fa' ? 'rtl' : 'ltr'} style={{ padding: '4px 8px', fontSize: 10.5, color: 'var(--text-dim)' }}>{t.diffTruncated}</div>}
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
  lang?: Language;
}
export const FileEditsRow: React.FC<RowProps> = memo(({ group, details, onRequestIds, label, editsWord = 'edits', defaultOpen = false, lang = 'en' }) => {
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
      <button onClick={toggle} dir={lang === 'fa' ? 'rtl' : 'ltr'} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', background: 'transparent', border: 'none', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-main)', fontSize: 12 }}>
        {open ? <ChevronDown size={12} /> : (lang === 'fa' ? <ChevronLeft size={12} /> : <ChevronRight size={12} />)}
        <AgentIcon kind="patch" color="var(--accent-green)" />
        <span style={{ fontWeight: 600, flexShrink: 0 }}>{label}</span>
        <span dir="ltr" className="code-font" style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.file}</span>
        {group.items.length > 1 && <span style={{ fontSize: 10.5, color: 'var(--text-dim)', flexShrink: 0 }}>{group.items.length} {editsWord}</span>}
        <span dir="ltr" className="code-font" style={{ marginInlineStart: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
          <span style={{ color: 'var(--diff-add-text)' }}>+{group.added}</span>
          <span style={{ color: 'var(--diff-del-text)' }}>-{group.deleted}</span>
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {group.items.map((it, i) => (
            <DiffView key={it.id ?? i} detail={it.id != null ? details[it.id] : undefined} legacy={it.id == null} lang={lang} />
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
  lang?: Language;
}> = memo(({ edits, details, onRequestIds, label, editsWord, defaultOpen, lang = 'en' }) => (
  <div>
    {groupEditSummaries(edits).map(g => (
      <FileEditsRow key={g.file} group={g} details={details} onRequestIds={onRequestIds} label={label} editsWord={editsWord} defaultOpen={defaultOpen} lang={lang} />
    ))}
  </div>
));
