import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ArrowUp,
  Paperclip,
  Box,
  ChevronRight,
  X,
  FileText,
  Sparkles,
  PanelRight,
  PanelLeft,
  ChevronDown
} from 'lucide-react';
import { Attachment, RightPanelTab } from '../../types';
import { alertDialog } from '../modals/AppDialog';
import { SKILLS, SkillDef } from '../../utils/skills';
import { Tooltip } from '../shared/Tooltip';
import { RepoPickerMenu, isScratchPath, scratchLabel } from '../shared/RepoPicker';
import { ConnectionDock, ProvidersStatus, ProviderName } from '../layout/ConnectionDock';

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
  selectedProvider: 'deepseek' | 'gemini';
  onSelectProvider: (provider: 'deepseek' | 'gemini') => void;
  geminiThinking?: 'low' | 'medium' | 'high';
  onCycleThinking?: () => void;
  providers: ProvidersStatus;
  onConnectProvider: (p: ProviderName) => void;
  onShowProvider: (p: ProviderName) => void;
  onHideProvider: (p: ProviderName) => void;
  onDisconnectProvider: (p: ProviderName) => void;
  providerLocked?: boolean;
}


export const EmptyState: React.FC<EmptyStateProps> = ({
  repoName,
  activeWorkspace,
  recentWorkspaces,
  onOpenWorkspace,
  onStartScratch,
  onOpenFolder,
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
  providers,
  onConnectProvider,
  onShowProvider,
  onHideProvider,
  onDisconnectProvider,
  providerLocked = false
}) => {
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

  const skillsList = SKILLS;
  const isScratch = isScratchPath(activeWorkspace);
  const repoLabel = isScratch ? scratchLabel : (activeWorkspace ? repoName : 'No Repo');

  const filteredSkills = skillsList.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.desc.toLowerCase().includes(searchQuery.toLowerCase())
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
  };

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {}
      <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', gap: 6 }}>
        {!isSidebarOpen ? (
          <Tooltip content="Show Sidebar" shortcut="Ctrl+B" position="bottom">
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
          <Tooltip content="Show Panel" shortcut="Ctrl Alt B" position="bottom">
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
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{repoLabel}</span>
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
        style={{ width: '100%', maxWidth: '640px', background: 'var(--bg-surface)', border: isDragging ? '1px dashed var(--accent-green)' : '1px solid var(--border-subtle)', borderRadius: '14px', padding: '12px 14px', boxShadow: '0 10px 40px var(--shadow-heavy)', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
            {attachments.map((att) => (
              <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', color: 'var(--text-main)', maxWidth: '200px' }}>
                {att.type.startsWith('image/') ? (
                  <img src={att.base64} alt={att.name} style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'cover' }} />
                ) : (
                  <FileText size={14} color="var(--accent-green)" />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                <X size={12} style={{ cursor: 'pointer', color: 'var(--diff-del-text)' }} onClick={() => removeAttachment(att.id)} />
              </div>
            ))}
          </div>
        )}

          <textarea
            ref={textareaRef}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Plan, Build, / for skills, @ for context — paste screenshot or drop files here"
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '13.5px', fontFamily: 'inherit', resize: 'none', minHeight: '56px', maxHeight: '240px', overflowY: 'auto', width: '100%', lineHeight: '1.5', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Add skills, context, or attach files"
              style={{ background: isMenuOpen ? 'var(--bg-surface-hover)' : 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '50%', width: '26px', height: '26px', color: isMenuOpen ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease', flexShrink: 0 }}
            >
              <Plus size={15} />
            </button>

            {activeSkill && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: activeSkill.color, background: `${activeSkill.color}1f`, border: `1px solid ${activeSkill.color}66`, animation: 'none' }}>
                {activeSkill.icon}
                <span>{activeSkill.name}</span>
                <X size={12} style={{ cursor: 'pointer', opacity: 0.85 }} onClick={() => setActiveSkill(null)} />
              </span>
            )}

            {isMenuOpen && (
              <div
                ref={menuRef}
                style={{ position: 'absolute', top: '100%', left: '0', marginTop: '8px', width: '360px', maxWidth: '92vw', background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', borderRadius: '12px', boxShadow: '0 16px 40px var(--shadow-heavy)', padding: '6px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '2px' }}
              >
                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search skills, context, chats..."
                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '12px' }}
                  />
                </div>
                {filteredSkills.map((s) => (
                  <div key={s.id} onClick={() => selectSkill(s)} className="hover-bright" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                    <div style={{ width: '16px', display: 'flex', justifyContent: 'center', color: s.color }}>{s.icon}</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{s.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{s.desc}</span>
                    </div>
                  </div>
                ))}
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                <div onClick={() => fileInputRef.current?.click()} className="hover-bright" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                  <Paperclip size={14} color="var(--text-muted)" />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>Attach</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Images, PDF, DOC, XLSX, PPT, Code — up to 100MB each</span>
                  </div>
                </div>
                <div onClick={() => alertDialog({ title: 'MCP', message: 'Model Context Protocol (MCP) is active.' })} className="hover-bright" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Box size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>MCP</span>
                  </div>
                  <ChevronRight size={13} color="var(--text-dim)" />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selectedProvider === 'deepseek' ? (
              <div
                onClick={onToggleDeepThink}
                title={isDeepThink ? 'DeepThink reasoning is ON' : 'DeepThink reasoning is OFF'}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: isDeepThink ? 'var(--accent-green)' : 'var(--text-muted)', cursor: 'pointer', padding: '3px 8px', borderRadius: '6px', background: isDeepThink ? 'var(--accent-green-dim)' : 'var(--bg-card)', border: `1px solid ${isDeepThink ? 'var(--border-active)' : 'var(--border-subtle)'}` }}
              >
                <Sparkles size={11} />
                <span style={{ fontWeight: 600 }}>DeepThink</span>
              </div>
            ) : (
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
            <ConnectionDock
              providers={providers}
              selectedProvider={selectedProvider}
              onSelectProvider={onSelectProvider}
              onConnect={onConnectProvider}
              onShowBrowser={onShowProvider}
              onHideBrowser={onHideProvider}
              onDisconnect={onDisconnectProvider}
              locked={providerLocked}
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

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="prompt-chip" onClick={() => selectSkill(skillsList.find(s => s.id === 'plan')!)}>
          Plan New Idea <span style={{ opacity: 0.5, fontSize: '10px' }}>⇥ Tab</span>
        </button>
        <button className="prompt-chip" onClick={() => selectSkill(skillsList.find(s => s.id === 'multitask')!)}>
          Multitask
        </button>
      </div>
      <div style={{ marginTop: '20px', fontSize: '11px', color: 'var(--text-dim)' }}>
        Use{' '}
        <code
          onClick={() => {
            const askSkill = skillsList.find(s => s.id === 'ask');
            if (askSkill) {
              selectSkill(askSkill);
              textareaRef.current?.focus();
            }
          }}
          className="hover-bright"
          title="Click to activate /ask skill"
          style={{
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
        </code>{' '}
        to research your codebase before starting code changes
      </div>
      </div>
      </div>
    </div>
  );
};
