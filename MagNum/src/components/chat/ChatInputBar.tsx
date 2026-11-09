import React, { useState, useRef, useEffect } from 'react';
import { Plus, ArrowUp, RefreshCw, Square, Sparkles, X, FileText, Globe, MonitorOff } from 'lucide-react';
import { Attachment } from '../../types';
import { alertDialog } from '../modals/AppDialog';

interface ChatInputBarProps {
  isRunning: boolean;
  isDeepThink?: boolean;
  onToggleDeepThink?: () => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  onOpenFolder: () => void;
  provider?: 'deepseek' | 'gemini';
  geminiThinking?: 'low' | 'medium' | 'high';
  onCycleThinking?: () => void;
  onShowBrowser?: () => void;
  onHideBrowser?: () => void;
}

const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE = 100 * 1024 * 1024; 
const MAX_TOTAL_SIZE = 300 * 1024 * 1024; 

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  isRunning,
  isDeepThink,
  onToggleDeepThink,
  onSend,
  onStop,
  provider,
  geminiThinking,
  onCycleThinking,
  onShowBrowser,
  onHideBrowser
}) => {
  const [val, setVal] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [modelHover, setModelHover] = useState(false);
  const [modelMenuPinned, setModelMenuPinned] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [val]);

  
  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const oversized = incoming.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      alertDialog({
        title: 'File too large',
        message: `DeepSeek accepts files up to 100MB each. Skipped: ${oversized.map((f) => f.name || 'unnamed file').join(', ')}`
      });
    }
    
    const currentTotal = attachments.reduce((sum, a) => sum + (a.size || 0), 0);
    let budget = MAX_TOTAL_SIZE - currentTotal;
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_FILE_SIZE) continue;
      if (f.size > budget) {
        alertDialog({ title: 'Attachment limit', message: `Total size limit (${MAX_TOTAL_SIZE / (1024 * 1024)}MB) reached — "${f.name || 'unnamed file'}" and the rest were skipped.` });
        break;
      }
      valid.push(f);
      budget -= f.size;
    }
    if (valid.length === 0) return;
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      alertDialog({ title: 'Attachment limit', message: `Maximum ${MAX_ATTACHMENTS} files/images can be attached. Remove some first.` });
      return;
    }
    if (valid.length > remaining) {
      alertDialog({ title: 'Attachment limit', message: `Only ${remaining} of ${valid.length} file(s) added — the limit is ${MAX_ATTACHMENTS}.` });
    }
    valid.slice(0, remaining).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const safeName = file.name || `pasted-image-${Date.now()}.png`;
        setAttachments((prev) => {
          if (prev.length >= MAX_ATTACHMENTS) return prev;
          return [
            ...prev,
            { id: Math.random().toString(36).substring(2, 9), name: safeName, size: file.size, type: file.type, base64 }
          ];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  
  const handlePaste = (e: React.ClipboardEvent) => {
    const files: File[] = [];
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const f = items[i].getAsFile();
          if (f) files.push(f);
        }
      }
    }
    if (!files.length && e.clipboardData?.files?.length) {
      files.push(...Array.from(e.clipboardData.files));
    }
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      
      if (isRunning) return;
      e.preventDefault();
      submit();
    }
  };

  const submit = () => {
    
    if (isRunning) return;
    if (val.trim() || attachments.length > 0) {
      onSend(val.trim(), attachments);
      setVal('');
      setAttachments([]);
    }
  };

  const canSend = Boolean(val.trim()) || attachments.length > 0;

  return (
    <div style={{ padding: '0 24px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        multiple
        accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.txt,.json,.js,.ts,.tsx,.jsx,.html,.css,.rs,.py"
        style={{ display: 'none' }}
      />
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        style={{
          width: '100%',
          maxWidth: 780,
          background: 'var(--bg-surface)',
          border: isDragging ? '1px dashed var(--accent-green)' : '1px solid var(--border-subtle)',
          borderRadius: 22,
          padding: '8px 10px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          boxShadow: 'var(--shadow-input)'
        }}>
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '2px 4px', alignItems: 'center' }}>
            {attachments.map((att) => (
              <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--text-main)', maxWidth: 200 }}>
                {att.type.startsWith('image/') ? (
                  <img src={att.base64} alt={att.name} style={{ width: 16, height: 16, borderRadius: 3, objectFit: 'cover' }} />
                ) : (
                  <FileText size={14} color="var(--accent-green)" />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                <X size={12} style={{ cursor: 'pointer', color: 'var(--diff-del-text)' }} onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))} />
              </div>
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>{attachments.length}/{MAX_ATTACHMENTS}</span>
          </div>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isRunning
            ? 'Agent is working... type your next message now — it sends when the task finishes'
            : 'Send follow-up... (Ctrl+V screenshot or drop files here)'}
          dir="auto"
          style={{
            display: 'block',
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-main)',
            fontSize: 13,
            fontFamily: 'inherit',
            lineHeight: 1.55,
            resize: 'none',
            padding: '2px 4px',
            maxHeight: 180,
            overflowY: 'auto',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere'
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            title={`Attach files / images (max ${MAX_ATTACHMENTS}, 100MB each)`}
            className="hover-bright"
            style={{ background: 'var(--bg-card)', border: 'none', color: 'var(--text-muted)', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <Plus size={14} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {provider !== 'gemini' && onToggleDeepThink && (
              <button
                onClick={onToggleDeepThink}
                title={isDeepThink ? 'DeepThink reasoning is ON' : 'DeepThink reasoning is OFF'}
                className="hover-bright"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                  color: isDeepThink ? 'var(--accent-green)' : 'var(--text-muted)',
                  padding: '3px 8px', borderRadius: 8, cursor: 'pointer',
                  background: isDeepThink ? 'var(--accent-green-dim)' : 'transparent',
                  border: `1px solid ${isDeepThink ? 'var(--border-active)' : 'transparent'}`,
                  flexShrink: 0
                }}
              >
                <Sparkles size={11} />
                <span style={{ fontWeight: 600 }}>DeepThink</span>
              </button>
            )}
            {provider === 'gemini' && (
              <button
                onClick={onCycleThinking}
                title={`Gemini Thinking Level: ${geminiThinking || 'medium'} — click to change (Low / Medium / High)`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                  color: 'var(--accent-green)', padding: '3px 8px', borderRadius: 8,
                  background: 'var(--accent-green-dim)', border: '1px solid var(--border-active)',
                  flexShrink: 0, cursor: 'pointer'
                }}
              >
                <Sparkles size={11} />
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{geminiThinking || 'medium'}</span>
              </button>
            )}
            <div
              style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              onMouseEnter={() => setModelHover(true)}
              onMouseLeave={() => setModelHover(false)}
            >
              {}
              {(modelHover || modelMenuPinned) && (onShowBrowser || onHideBrowser) && (
                <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', paddingBottom: 6, zIndex: 60 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 4, background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', borderRadius: 8, boxShadow: '0 8px 22px var(--shadow-heavy)', minWidth: 140 }}>
                    {onShowBrowser && (
                      <button
                        onClick={onShowBrowser}
                        title="Show provider browser window (same open tab — never a new one)"
                        className="hover-bright"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--accent-green)', borderRadius: 6, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <Globe size={13} />
                        <span>Show Browser</span>
                      </button>
                    )}
                    {onHideBrowser && (
                      <button
                        onClick={onHideBrowser}
                        title="Hide browser window again (back to background)"
                        className="hover-bright"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', borderRadius: 6, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <MonitorOff size={13} />
                        <span>Hide Browser</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
              {}
              <button
                onClick={() => setModelMenuPinned(p => !p)}
                title="Model is locked for this conversation"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                  padding: '3px 8px',
                  borderRadius: 8,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <span style={{ fontWeight: 600 }}>{provider === 'gemini' ? 'Gemini' : 'DeepSeek'}</span>
              </button>
            </div>
            {isRunning ? (
              <button
                onClick={onStop}
                title="Stop"
                style={{ background: '#ef4444', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <Square size={10} fill="#fff" color="#fff" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canSend}
                style={{
                  background: canSend ? 'var(--accent-green)' : 'var(--bg-card)',
                  color: canSend ? 'var(--on-accent)' : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canSend ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                <ArrowUp size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 780, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 11, color: 'var(--text-dim)' }}>
        <RefreshCw size={11} className="hover-bright" style={{ cursor: 'pointer' }} />
      </div>
    </div>
  );
};
