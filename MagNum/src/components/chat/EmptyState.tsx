import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ArrowUp,
  Paperclip,
  Box,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Brain,
  PanelRight,
  PanelLeft,
  ChevronDown
} from 'lucide-react';
import { Attachment, RightPanelTab } from '../../types';
import { alertDialog } from '../modals/AppDialog';
import { SKILLS, SkillDef, getSkillText } from '../../utils/skills';
import { Tooltip } from '../shared/Tooltip';
import { RepoPickerMenu, isScratchPath } from '../shared/RepoPicker';
import { ConnectionDock, ProvidersStatus, ProviderName } from '../layout/ConnectionDock';
import { AttachmentPreview } from '../shared/AttachmentViews';
import { stageAttachments as stageToProvider, unstageAttachment, trackComposerAttachments } from '../../utils/attachmentStaging';
import {
  getModelCharLimit,
  getCharCounterThreshold,
  getProviderDisplayName,
  getHigherLimitProviderNames
} from '../../utils/providerLimits';
import { Language, translations } from '../../i18n/translations';

interface EmptyStateProps {
  repoName: string;
  activeWorkspace: string;
  recentWorkspaces: string[];
  onOpenWorkspace: (p: string) => void;
  onStartScratch: () => void;
  isDeepThink: boolean;
  autoApplyPatch: boolean;
  onToggleDeepThink: () => void;
  onToggleAutoPatch: () => void;
  onOpenFolder: () => void;
  onBrowseInApp?: () => void;
  onSubmit: (text: string, attachments: Attachment[], skillId: string | null) => void;
  onOpenRightTab?: (tab: RightPanelTab) => void;
  activeRightTab?: RightPanelTab;
  openTabs?: Exclude<RightPanelTab, null>[];
  onCloseTab?: (tab: Exclude<RightPanelTab, null>) => void;
  showApps?: boolean;
  onToggleApps?: () => void;
  onOpenIDE?: () => void;
  onTogglePanel?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  selectedProvider: 'deepseek' | 'gemini' | 'chatgpt';
  onSelectProvider: (provider: 'deepseek' | 'gemini' | 'chatgpt') => void;
  geminiThinking?: 'low' | 'medium' | 'high';
  onCycleThinking?: () => void;
  chatgptThink?: boolean;
  onToggleChatgptThink?: () => void;
  providers: ProvidersStatus;
  onConnectProvider: (p: ProviderName) => void;
  onShowProvider: (p: ProviderName) => void;
  onHideProvider: (p: ProviderName) => void;
  onDisconnectProvider: (p: ProviderName) => void;
  providerLocked?: boolean;
  lang?: Language;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  repoName,
  activeWorkspace,
  recentWorkspaces,
  onOpenWorkspace,
  onStartScratch,
  onOpenFolder,
  onBrowseInApp,
  isDeepThink,
  onToggleDeepThink,
  onSubmit,
  activeRightTab,
  onTogglePanel,
  isSidebarOpen,
  onToggleSidebar,
  selectedProvider,
  onSelectProvider,
  geminiThinking,
  onCycleThinking,
  chatgptThink = true,
  onToggleChatgptThink,
  providers,
  onConnectProvider,
  onShowProvider,
  onHideProvider,
  onDisconnectProvider,
  providerLocked = false,
  lang = 'en'
}) => {
  const t = translations[lang];
  const isFa = lang === 'fa';
  const [inputVal, setInputVal] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeSkill, setActiveSkill] = useState<SkillDef | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [repoMenu, setRepoMenu] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [inputVal]);

  useEffect(() => {
    trackComposerAttachments(attachments);
    if (attachments.length > 0) {
      stageToProvider(selectedProvider, attachments);
    }
  }, [attachments, selectedProvider]);

  const skillsList = SKILLS;
  const isScratch = isScratchPath(activeWorkspace);
  const repoLabel = isScratch ? t.startFromScratch : (activeWorkspace ? repoName : t.noRepo);

  const q = searchQuery.toLowerCase();
  const filteredSkills = skillsList.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.desc.toLowerCase().includes(q) ||
    s.nameFa.toLowerCase().includes(q) ||
    s.descFa.toLowerCase().includes(q)
  );

  const selectSkill = (s: SkillDef) => {
    setActiveSkill(s);
    setIsMenuOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '/' && inputVal.trim() === '') {
      setIsMenuOpen(true);
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Backspace' && inputVal === '' && activeSkill) {
      setActiveSkill(null);
    }
  };

  const handleSend = () => {
    if (inputVal.length > maxMessageChars) {
      const higherModels = getHigherLimitProviderNames(maxMessageChars);
      const hint = higherModels.length
        ? t.msgTooLongSwitchHint(higherModels.join(' / '))
        : t.msgTooLongShortenHint;
      alertDialog({
        title: t.msgTooLongTitle,
        message: t.msgTooLongMsg(inputVal.length, maxMessageChars, getProviderDisplayName(selectedProvider), hint)
      });
      return;
    }
    const base = inputVal.trim();
    if (base || attachments.length > 0) {
      onSubmit(base, attachments, activeSkill ? activeSkill.id : null);
      setInputVal('');
      setAttachments([]);
      setActiveSkill(null);
      setIsMenuOpen(false);
    }
  };

  const MAX_ATTACHMENTS = 10;
  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 300 * 1024 * 1024;
  const maxMessageChars = getModelCharLimit(selectedProvider);
  const charCounterAt = getCharCounterThreshold(maxMessageChars);

  const handleInputChange = (next: string) => {
    setInputVal((prev) => {
      if (next.length <= maxMessageChars) return next;
      if (prev.length > maxMessageChars && next.length <= prev.length) return next;
      return next.slice(0, maxMessageChars);
    });
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsMenuOpen(false);
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

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    unstageAttachment(selectedProvider, id);
  };

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', gap: 6 }}>
        {!isSidebarOpen ? (
          <Tooltip content={t.showSidebar} shortcut="Ctrl+B" position="bottom">
            <button
              onClick={onToggleSidebar}
              className="hover-bright"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', padding: 4, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <PanelLeft size={14} />
            </button>
          </Tooltip>
        ) : <div />}
        {!activeRightTab ? (
          <Tooltip content={t.showPanel} shortcut="Ctrl Alt B" position="bottom">
            <button
              onClick={onTogglePanel}
              className="hover-bright"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', padding: 4, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <PanelRight size={14} />
            </button>
          </Tooltip>
        ) : <div />}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.txt,.json,.js,.ts,.tsx,.jsx,.html,.css,.rs,.py"
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                onClick={() => setRepoMenu(v => !v)}
                className="hover-bright"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', background: 'transparent', border: 'none', padding: '3px 6px', borderRadius: 4, cursor: 'pointer' }}
              >
                <span dir="auto" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{repoLabel}</span>
                <ChevronDown size={11} />
              </button>
              <RepoPickerMenu
                open={repoMenu}
                onClose={() => setRepoMenu(false)}
                recents={recentWorkspaces}
                activePath={activeWorkspace}
                isScratch={isScratch}
                onSelect={onOpenWorkspace}
                onScratch={onStartScratch}
                onOpenFolder={onOpenFolder}
                onBrowseInApp={onBrowseInApp}
                lang={lang}
              />
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            style={{ width: '100%', maxWidth: '640px', background: 'var(--bg-surface)', border: isDragging ? '1px dashed var(--accent-green)' : '1px solid var(--border-subtle)', borderRadius: '14px', padding: '12px 14px', boxShadow: '0 10px 40px var(--shadow-heavy)', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}
          >
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 6, alignItems: 'center' }}>
                <AttachmentPreview attachments={attachments} variant="composer" onRemove={removeAttachment} lang={lang} />
              </div>
            )}

            <textarea
              ref={textareaRef}
              dir={inputVal ? 'auto' : (isFa ? 'rtl' : 'ltr')}
              value={inputVal}
              maxLength={maxMessageChars}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={t.emptyPlaceholder}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '13.5px', fontFamily: 'inherit', resize: 'none', minHeight: '56px', maxHeight: '240px', overflowY: 'auto', width: '100%', lineHeight: '1.5', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  title={t.addSkillsAttachTitle}
                  style={{ background: isMenuOpen ? 'var(--bg-surface-hover)' : 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '50%', width: '26px', height: '26px', color: isMenuOpen ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease', flexShrink: 0 }}
                >
                  <Plus size={15} />
                </button>

                {activeSkill && (
                  <span dir={isFa ? 'rtl' : 'ltr'} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: activeSkill.color, background: `${activeSkill.color}1f`, border: `1px solid ${activeSkill.color}66`, animation: 'none' }}>
                    {activeSkill.icon}
                    <span>{getSkillText(activeSkill, lang).name}</span>
                    <X size={12} style={{ cursor: 'pointer', opacity: 0.85 }} onClick={() => setActiveSkill(null)} />
                  </span>
                )}

                {isMenuOpen && (
                  <div
                    ref={menuRef}
                    dir={isFa ? 'rtl' : 'ltr'}
                    style={{ position: 'absolute', top: '100%', left: '0', marginTop: '8px', width: '360px', maxWidth: '92vw', background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', borderRadius: '12px', boxShadow: '0 16px 40px var(--shadow-heavy)', padding: '6px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '2px' }}
                  >
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                      <input
                        type="text"
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.searchSkillsPlaceholder}
                        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '12px' }}
                      />
                    </div>
                    {filteredSkills.map((s) => {
                      const st = getSkillText(s, lang);
                      return (
                        <div key={s.id} onClick={() => selectSkill(s)} className="hover-bright" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                          <div style={{ width: '16px', display: 'flex', justifyContent: 'center', color: s.color }}>{s.icon}</div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{st.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{st.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                    <div onClick={() => fileInputRef.current?.click()} className="hover-bright" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                      <Paperclip size={14} color="var(--text-muted)" />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{t.attachLabel}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{t.attachDesc}</span>
                      </div>
                    </div>
                    <div onClick={() => alertDialog({ title: t.mcpAlertTitle, message: t.mcpAlertMessage })} className="hover-bright" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Box size={14} color="var(--text-muted)" />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{t.mcpLabel}</span>
                      </div>
                      {isFa ? <ChevronLeft size={13} color="var(--text-dim)" /> : <ChevronRight size={13} color="var(--text-dim)" />}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {inputVal.length >= charCounterAt && (
                  <span className="code-font" style={{ fontSize: 10, flexShrink: 0, color: inputVal.length >= maxMessageChars ? 'var(--diff-del-text)' : 'var(--text-dim)' }}>
                    {inputVal.length}/{maxMessageChars}
                  </span>
                )}
                {selectedProvider === 'deepseek' ? (
                  <div
                    onClick={onToggleDeepThink}
                    title={isDeepThink ? t.deepThinkOn : t.deepThinkOff}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: isDeepThink ? 'var(--accent-green)' : 'var(--text-muted)', cursor: 'pointer', padding: '3px 8px', borderRadius: '6px', background: isDeepThink ? 'var(--accent-green-dim)' : 'var(--bg-card)', border: `1px solid ${isDeepThink ? 'var(--border-active)' : 'var(--border-subtle)'}` }}
                  >
                    <Sparkles size={11} />
                    <span style={{ fontWeight: 600 }}>DeepThink</span>
                  </div>
                ) : selectedProvider === 'gemini' ? (
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
                ) : (
                  <button
                    onClick={onToggleChatgptThink}
                    title={chatgptThink ? t.chatgptThinkOn : t.chatgptThinkOff}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                      color: chatgptThink ? '#10a37f' : 'var(--text-muted)',
                      padding: '3px 8px', borderRadius: 8,
                      background: chatgptThink ? 'rgba(16,163,127,0.12)' : 'var(--bg-card)',
                      border: `1px solid ${chatgptThink ? 'rgba(16,163,127,0.4)' : 'var(--border-subtle)'}`,
                      flexShrink: 0, cursor: 'pointer'
                    }}
                  >
                    <Brain size={11} />
                    <span style={{ fontWeight: 600 }}>Think</span>
                  </button>
                )}
                <ConnectionDock
                  providers={providers}
                  selectedProvider={selectedProvider}
                  onSelectProvider={onSelectProvider}
                  onConnect={onConnectProvider}
                  onShowBrowser={onShowProvider}
                  onHideBrowser={onHideProvider}
                  onDisconnect={onDisconnectProvider}
                  locked={providerLocked}
                  lang={lang}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputVal.trim() && attachments.length === 0}
                  style={{ background: (inputVal.trim() || attachments.length > 0) ? 'var(--accent-green)' : 'var(--bg-card)', color: (inputVal.trim() || attachments.length > 0) ? 'var(--on-accent)' : 'var(--text-dim)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (inputVal.trim() || attachments.length > 0) ? 'pointer' : 'default', transition: 'all 0.15s' }}
                >
                  <ArrowUp size={14} />
                </button>
              </div>
            </div>
          </div>

          <div dir={isFa ? 'rtl' : 'ltr'} style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="prompt-chip" onClick={() => selectSkill(skillsList.find(s => s.id === 'plan')!)}>
              {t.planNewIdea} <span dir="ltr" style={{ opacity: 0.5, fontSize: '10px' }}>⇥ Tab</span>
            </button>
            <button className="prompt-chip" onClick={() => selectSkill(skillsList.find(s => s.id === 'multitask')!)}>
              {t.multitaskChip}
            </button>
          </div>
          <div dir={isFa ? 'rtl' : 'ltr'} style={{ marginTop: '20px', fontSize: '11px', color: 'var(--text-dim)' }}>
            {t.askHintBefore}
            <code
              dir="ltr"
              onClick={() => {
                const askSkill = skillsList.find(s => s.id === 'ask');
                if (askSkill) {
                  selectSkill(askSkill);
                  textareaRef.current?.focus();
                }
              }}
              className="hover-bright"
              title={t.askChipTitle}
              style={{
                unicodeBidi: 'isolate',
                color: 'var(--accent-green)',
                cursor: 'pointer',
                padding: '1px 5px',
                borderRadius: '4px',
                background: 'var(--accent-green-dim)',
                border: '1px solid var(--border-active)',
                fontWeight: 600
              }}
            >
              /ask
            </code>
            {t.askHintAfter}
          </div>
        </div>
      </div>
    </div>
  );
};
