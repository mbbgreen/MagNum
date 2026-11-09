import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export interface DialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface DialogState extends DialogOptions {
  mode: 'confirm' | 'alert';
}


let currentResolve: ((ok: boolean) => void) | null = null;
let currentDialog: DialogState | null = null;
const listeners = new Set<(d: DialogState | null) => void>();

function emit(d: DialogState | null) {
  currentDialog = d;
  listeners.forEach(fn => fn(d));
}

function openDialog(mode: 'confirm' | 'alert', opts: DialogOptions): Promise<boolean> {
  return new Promise(resolve => {
    if (currentResolve) currentResolve(false); 
    currentResolve = resolve;
    emit({ mode, ...opts });
  });
}

export const confirmDialog = (opts: DialogOptions) => openDialog('confirm', opts);
export const alertDialog = (opts: DialogOptions) => openDialog('alert', opts);

function close(ok: boolean) {
  const r = currentResolve;
  currentResolve = null;
  emit(null);
  if (r) r(ok);
}


export const AppDialogHost: React.FC = () => {
  const [dialog, setDialog] = useState<DialogState | null>(currentDialog);

  useEffect(() => {
    listeners.add(setDialog);
    return () => { listeners.delete(setDialog); };
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  if (!dialog) return null;
  const isConfirm = dialog.mode === 'confirm';

  return (
    <div
      onMouseDown={() => close(false)}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
        zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 400, background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)', borderRadius: 12,
          boxShadow: '0 24px 60px var(--shadow-heavy)',
          padding: 18, display: 'flex', flexDirection: 'column', gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: dialog.danger ? 'var(--diff-del)' : 'var(--accent-green-dim)',
            color: dialog.danger ? 'var(--diff-del-text)' : 'var(--accent-green)'
          }}>
            {dialog.danger ? <AlertTriangle size={15} /> : <Info size={15} />}
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-main)' }}>{dialog.title}</span>
        </div>

        <div dir="auto" className="selectable-text" style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7, paddingLeft: 40 }}>
          {dialog.message}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          {isConfirm && (
            <button
              onClick={() => close(false)}
              className="hover-bright"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {dialog.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            onClick={() => close(true)}
            className="hover-bright"
            style={{
              background: dialog.danger ? '#ef4444' : 'var(--accent-green)',
              border: 'none', color: dialog.danger ? '#fff' : 'var(--on-accent)',
              padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer'
            }}
          >
            {dialog.confirmLabel || (isConfirm ? 'Confirm' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
};
