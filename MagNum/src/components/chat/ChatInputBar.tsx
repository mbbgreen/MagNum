import React, { useState, useRef, useEffect } from 'react';
import { Plus, ArrowUp, RefreshCw, Square, Sparkles, Globe, MonitorOff, Brain } from 'lucide-react';
import { Attachment } from '../../types';
import { alertDialog } from '../modals/AppDialog';
import { AttachmentPreview } from '../shared/AttachmentViews';
import { stageAttachments as stageToProvider, unstageAttachment, trackComposerAttachments } from '../../utils/attachmentStaging';
import { getModelCharLimit, getCharCounterThreshold, getProviderDisplayName } from '../../utils/providerLimits';
import { Language, translations } from '../../i18n/translations';

interface ChatInputBarProps {
  isRunning: boolean;
  isDeepThink?: boolean;
  onToggleDeepThink?: () => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  onOpenFolder: () => void;
  provider?: 'deepseek' | 'gemini' | 'chatgpt';
  geminiThinking?: 'low' | 'medium' | 'high';
  onCycleThinking?: () => void;
  chatgptThink?: boolean;
  onToggleChatgptThink?: () => void;
  onShowBrowser?: () => void;
  onHideBrowser?: () => void;
  lang?: Language;
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
  chatgptThink = true,
  onToggleChatgptThink,
  onShowBrowser,
  onHideBrowser,
  lang = 'en'
}) => {
  const t = translations[lang];
  const isFa = lang === 'fa';
  const [val, setVal] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [modelHover, setModelHover] = useState(false);
  const [modelMenuPinned, setModelMenuPinned] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxMessageChars = getModelCharLimit(provider);
  const charCounterAt = getCharCounterThreshold(maxMessageChars);

  const handleValChange = (next: string) => {
    setVal((prev) => {
      if (next.length <= maxMessageChars) return next;
      if (prev.length > maxMessageChars && next.length <= prev.length) return next;
      return next.slice(0, maxMessageChars);
    });
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [val]);

  useEffect(() => {
    trackComposerAttachments(attachments);
    if (attachments.length > 0) {
      stageToProvider(provider ?? 'deepseek', attachments);
    }
  }, [attachments, provider]);

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const oversized = incoming.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      alertDialog({
        title: t.fileTooLargeTitle,
        message: t.fileTooLargeMsg(oversized.map((f) => f.name || 'file').join(isFa ? '، ' : ', '))
      });
    }

    const currentTotal = attachments.reduce((sum, a) => sum + (a.size || 0), 0);
    let budget = MAX_TOTAL_SIZE - currentTotal;
    const valid: File[] = [];
    for (const f of incoming) {
      if (f.size > MAX_FILE_SIZE) continue;
      if (f.size > budget) {
        alertDialog({
          title: t.attachLimitTitle,
          message: t.attachTotalLimitMsg(MAX_TOTAL_SIZE / (1024 * 1024), f.name || 'file')
        });
        break;
      }
      valid.push(f);
      budget -= f.size;
    }
    if (valid.length === 0) return;
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      alertDialog({ title: t.attachLimitTitle, message: t.attachMaxCountMsg(MAX_ATTACHMENTS) });
      return;
    }
    if (valid.length > remaining) {
      alertDialog({ title: t.attachLimitTitle, message: t.attachPartialCountMsg(remaining, valid.length, MAX_ATTACHMENTS) });
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
    if (val.length > maxMessageChars) {
      alertDialog({
        title: t.msgTooLongTitle,
        message: t.msgTooLongMsg(val.length, maxMessageChars, getProviderDisplayName(provider), t.msgTooLongShortenHint)
      });
      return;
    }
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
        }}
      >
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '6px 6px 4px', alignItems: 'center' }}>
            <AttachmentPreview
              attachments={attachments}
              variant="composer"
              lang={lang}
              onRemove={(id) => {
                setAttachments(prev => prev.filter(a => a.id !== id));
                unstageAttachment(provider ?? 'deepseek', id);
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>{attachments.length}/{MAX_ATTACHMENTS}</span>
          </div>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          value={val}
          maxLength={maxMessageChars}
          onChange={(e) => handleValChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isRunning ? t.inputRunningPlaceholder : t.inputIdlePlaceholder}
          dir={val ? 'auto' : (isFa ? 'rtl' : 'ltr')}
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
            title={t.attachFilesTip(MAX_ATTACHMENTS)}
            className="hover-bright"
            style={{ background: 'var(--bg-card)', border: 'none', color: 'var(--text-muted)', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <Plus size={14} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {val.length >= charCounterAt && (
              <span className="code-font" style={{ fontSize: 10, flexShrink: 0, color: val.length >= maxMessageChars ? 'var(--diff-del-text)' : 'var(--text-dim)' }}>
                {val.length}/{maxMessageChars}
              </span>
            )}
            {provider === 'deepseek' && onToggleDeepThink && (
              <button
                onClick={onToggleDeepThink}
                title={isDeepThink ? t.deepThinkOn : t.deepThinkOff}
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
                title={t.geminiThinkTip(geminiThinking || 'medium')}
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
            {provider === 'chatgpt' && (
              <button
                onClick={onToggleChatgptThink}
                title={chatgptThink ? t.chatgptThinkOn : t.chatgptThinkOff}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                  color: chatgptThink ? '#10a37f' : 'var(--text-muted)',
                  padding: '3px 8px', borderRadius: 8,
                  background: chatgptThink ? 'rgba(16,163,127,0.12)' : 'transparent',
                  border: `1px solid ${chatgptThink ? 'rgba(16,163,127,0.4)' : 'var(--border-subtle)'}`,
                  flexShrink: 0, cursor: 'pointer'
                }}
              >
                <Brain size={11} />
                <span style={{ fontWeight: 600 }}>Think</span>
              </button>
            )}
            <div
              style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              onMouseEnter={() => setModelHover(true)}
              onMouseLeave={() => setModelHover(false)}
            >
              {(modelHover || modelMenuPinned) && (onShowBrowser || onHideBrowser) && (
                <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', paddingBottom: 6, zIndex: 60 }}>
                  <div dir={isFa ? 'rtl' : 'ltr'} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 4, background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', borderRadius: 8, boxShadow: '0 8px 22px var(--shadow-heavy)', minWidth: 145 }}>
                    {onShowBrowser && (
                      <button
                        onClick={onShowBrowser}
                        title={t.showWindowTip}
                        className="hover-bright"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--accent-green)', borderRadius: 6, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <Globe size={13} />
                        <span>{t.showWindow}</span>
                      </button>
                    )}
                    {onHideBrowser && (
                      <button
                        onClick={onHideBrowser}
                        title={t.hideWindowTip}
                        className="hover-bright"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', borderRadius: 6, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        <MonitorOff size={13} />
                        <span>{t.hideWindow}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={() => setModelMenuPinned(p => !p)}
                title={t.modelLockedTip}
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
                <span style={{ fontWeight: 600 }}>{provider === 'gemini' ? 'Gemini' : provider === 'chatgpt' ? 'ChatGPT' : 'DeepSeek'}</span>
              </button>
            </div>
            {isRunning ? (
              <button
                onClick={onStop}
                title={t.stopTip}
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
