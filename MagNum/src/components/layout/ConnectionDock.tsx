import React, { useEffect, useRef, useState } from 'react';
import { Globe, LogOut, ChevronDown, Check, MonitorOff, Lock } from 'lucide-react';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type ProviderName = 'deepseek' | 'gemini';
export interface ProvidersStatus { deepseek: ConnectionStatus; gemini: ConnectionStatus; }

interface ConnectionDockProps {
  providers: ProvidersStatus;
  selectedProvider: ProviderName;
  onSelectProvider: (p: ProviderName) => void;
  onConnect: (p: ProviderName) => void;
  onShowBrowser: (p: ProviderName) => void;
  onHideBrowser: (p: ProviderName) => void;
  onDisconnect: (p: ProviderName) => void;
  locked?: boolean;
}

const META: Record<ProviderName, { label: string; color: string }> = {
  deepseek: { label: 'DeepSeek', color: 'var(--accent-green)' },
  gemini: { label: 'Gemini', color: '#4285f4' }
};

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Waiting for login…',
  connected: 'Connected'
};

export const ConnectionDock: React.FC<ConnectionDockProps> = ({
  providers, selectedProvider, onSelectProvider, onConnect,
  onShowBrowser, onHideBrowser, onDisconnect, locked = false
}) => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const dot = (s: ConnectionStatus, color: string) => (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
      background: s === 'connected' ? color : s === 'connecting' ? '#f59e0b' : 'var(--text-dim)',
      boxShadow: s === 'connected' ? `0 0 6px ${color}` : 'none',
      animation: s === 'connecting' ? 'cursorPulse 1.4s infinite' : 'none'
    }} />
  );

  const sel = selectedProvider;
  const selStatus = providers[sel];

  const pick = (p: ProviderName) => {
    if (locked) return;
    onSelectProvider(p);
    if (providers[p] === 'disconnected') onConnect(p);
    setOpen(false);
  };

  const row = (p: ProviderName) => {
    const s = providers[p];
    const active = p === sel;
    return (
      <div key={p} onClick={() => pick(p)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8,
        background: active ? 'var(--accent-green-dim)' : 'var(--bg-card)',
        border: `1px solid ${active ? 'var(--border-active)' : 'var(--border-subtle)'}`,
        cursor: locked && !active ? 'default' : 'pointer',
        opacity: locked && !active ? 0.45 : 1
      }}>
        {dot(s, META[p].color)}
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', flex: 1, minWidth: 0 }}>
          {META[p].label}
        </span>
        <span style={{ fontSize: 10.5, color: s === 'connected' ? META[p].color : 'var(--text-dim)', flexShrink: 0 }}>
          {STATUS_TEXT[s]}
        </span>
        {active && <Check size={12} color="var(--accent-green)" style={{ flexShrink: 0 }} />}

        {s !== 'disconnected' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button onClick={() => onShowBrowser(p)} title="Show Browser" className="hover-bright"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                  padding: '1px 4px', borderRadius: 4, fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap'
                }}>
                <Globe size={10} /> Show Browser
              </button>
              <button onClick={() => onHideBrowser(p)} title="Hide Browser" className="hover-bright"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-dim)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                  padding: '1px 4px', borderRadius: 4, fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap'
                }}>
                <MonitorOff size={10} /> Hide Browser
              </button>
            </span>
            <button onClick={() => onDisconnect(p)} title="Disconnect (profile kept)" className="hover-bright"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 3, borderRadius: 6 }}>
              <LogOut size={12} />
            </button>
          </span>
        )}
      </div>
    );
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} title="AI model & connection" className="hover-bright"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          color: 'var(--text-main)', fontWeight: 700, fontSize: 11,
          padding: '3px 10px', borderRadius: 999, cursor: 'pointer', flexShrink: 0
        }}>
        {dot(selStatus, META[sel].color)}
        <span>{META[sel].label}</span>
        {locked && <Lock size={10} style={{ opacity: 0.5 }} />}
        <ChevronDown size={11} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
          width: 310, background: 'var(--bg-popover)',
          border: '1px solid var(--border-subtle)', borderRadius: 12,
          boxShadow: '0 16px 40px var(--shadow-heavy)', padding: 8, zIndex: 4000,
          display: 'flex', flexDirection: 'column', gap: 6
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: 0.4, padding: '0 4px' }}>
            AI PROVIDERS {locked ? '(locked to this chat)' : '(one active at a time)'}
          </span>
          {row('deepseek')}
          {row('gemini')}
        </div>
      )}
    </div>
  );
};
