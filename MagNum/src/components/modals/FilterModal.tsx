import React, { useState } from 'react';

interface FilterModalProps {
  isOpen: boolean;
  ignoredPatterns: string[];
  onClose: () => void;
  onUpdateFilters: (newList: string[]) => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  ignoredPatterns,
  onClose,
  onUpdateFilters
}) => {
  const [newInput, setNewInput] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (newInput.trim() && !ignoredPatterns.includes(newInput.trim())) {
      onUpdateFilters([...ignoredPatterns, newInput.trim()]);
      setNewInput('');
    }
  };

  const handleRemove = (item: string) => {
    onUpdateFilters(ignoredPatterns.filter(i => i !== item));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '420px',
        background: 'var(--bg-popover)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Customize Ignored Items</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={newInput}
            onChange={(e) => setNewInput(e.target.value)}
            placeholder="Folder or file name (e.g. .git)"
            style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '6px 10px', borderRadius: '6px', color: 'var(--text-main)', fontSize: '12px' }}
          />
          <button onClick={handleAdd} style={{ background: 'var(--accent-green)', border: 'none', color: 'var(--on-accent)', padding: '0 12px', borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}>
            Add
          </button>
        </div>

        <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {ignoredPatterns.map(p => (
            <div key={p} style={{ background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{p}</span>
              <span onClick={() => handleRemove(p)} style={{ cursor: 'pointer', color: 'var(--diff-del-text)' }}>✕</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
