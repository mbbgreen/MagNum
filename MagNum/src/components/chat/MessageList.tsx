import React, { useRef, useState, useEffect } from 'react';
import {
  ArrowDown,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Diff,
  FileText,
  Globe,
  Loader2,
  MessageSquare,
  PanelRight,
  PanelLeft,
  RotateCcw,
  Terminal,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { ChatMessage, RightPanelTab } from '../../types';
import { MarkdownRenderer } from '../../utils/markdown';
import { formatRelativeAgo, formatDuration } from '../../utils/time';
import { SkillChip, stripSkillPrefix, detectSkillInText } from '../../utils/skills';
import { translations, Language } from '../../i18n/translations';
import { EditSummaryRows } from '../shared/EditDiff';
import { AgentIcon, ACTION_TO_ICON } from '../../utils/agentIcons';
import { EditDetail } from '../../types';
import { Tooltip } from '../shared/Tooltip';




function isSuccessfulPatchReport(m: ChatMessage): boolean {
  if (m.role !== 'agent' || m.action !== 'patch_file') return false;
  if (!Array.isArray(m.edits) || m.edits.length === 0) return false;
  const match = m.text.match(/Applied patches \((\d+)\/(\d+)\)|اعمال پچ‌ها \((\d+)\/(\d+)\)/);
  if (!match) return false;
  const ok = Number(match[1] ?? match[3]);
  const total = Number(match[2] ?? match[4]);
  return ok === total;
}


interface ToolInfo { kind: 'read' | 'search' | 'patch' | 'create' | 'command' | 'continue'; label: string; meta?: string; }
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function getToolInfo(m: ChatMessage, t: any): ToolInfo | null {
  switch (m.action) {
    case 'read_files':
    case 'read_file': {
      const files = Array.isArray(m.files) && m.files.length ? m.files : [];
      const meta = files.map(f => {
        const rm = m.text.match(new RegExp('`' + escapeRe(f) + '`\\s*\\(([^)]+)\\)'));
        return rm ? `${f} ${rm[1]}` : f;
      }).join(', ');
      return { kind: 'read', label: t.toolRead, meta: meta || undefined };
    }
    case 'continue_reading':
      return { kind: 'continue', label: t.toolContinue };
    case 'search_code': {
      const qm = m.text.match(/`([^`]+)`/);
      const cm = m.text.match(/\((\d+)/);
      return { kind: 'search', label: t.toolSearch, meta: qm ? `${qm[1]}${cm ? ` · ${cm[1]}` : ''}` : undefined };
    }
    case 'patch_file':
      return { kind: 'patch', label: t.edited };
    case 'create_file': {
      const f = m.file || (m.text.match(/Creating file:\s*(.+)/) || [])[1] || '';
      return { kind: 'create', label: t.toolCreate, meta: f.trim() || undefined };
    }
    case 'execute_command': {
      const c = m.command || (m.text.match(/Executing command:\s*(.+)/) || [])[1] || '';
      return { kind: 'command', label: t.toolCommand, meta: c.trim() || undefined };
    }
    case 'list_dir': {
      const pm = m.text.match(/`([^`]+)`/);
      return { kind: 'read', label: t.toolListDir, meta: pm ? pm[1] : undefined };
    }
    case 'browse_web': {
      const um = m.text.match(/\(([^)]+)\)\s*$/);
      return { kind: 'search', label: t.toolBrowse, meta: um ? um[1] : undefined };
    }
    case 'read_page':
      return { kind: 'read', label: t.toolReadPage };
    default:
      return null;
  }
}

interface MessageListProps {
  sessionTitle: string;
  repoName: string;
  messages: ChatMessage[];
  streamingState: { text?: string; thought?: string; action?: string | null } | null;
  agentStatus: string;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenRightTab: (tab: RightPanelTab) => void;
  activeRightTab: RightPanelTab;
  openTabs?: Exclude<RightPanelTab, null>[];
  onCloseTab?: (tab: Exclude<RightPanelTab, null>) => void;
  editDetails?: Record<number, EditDetail>;
  onRequestMessageEdits?: (messageId: number) => void;
  onRequestEditsIds?: (ids: number[]) => void;
  onReRunPrompt?: (text: string, skillId?: string | null) => void;
  onOpenIDE?: () => void;
  lang?: Language;
  hasMoreMessages?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
  isRunning?: boolean;
  animateId?: string | null;
  networkRetry?: { attempt: number; max: number } | null;
  sessionId?: string | null;
  inputBar?: React.ReactNode;
}

const headerBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim)',
  fontSize: 11.5,
  padding: '4px 6px',
  borderRadius: 6,
  cursor: 'pointer'
};

const RAIL_TABS: { key: Exclude<RightPanelTab, null>; label: string; icon: React.ReactNode }[] = [
  { key: 'changes', label: 'Changes', icon: <Diff size={13} /> },
  { key: 'browser', label: 'Browser', icon: <Globe size={13} /> },
  { key: 'terminal', label: 'powershell', icon: <Terminal size={13} /> },
  { key: 'files', label: 'Files', icon: <FileText size={13} /> }
];

const AnimatedMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const total = content.length;
  const animate = total > 0 && total < 15000;
  const [chars, setChars] = useState(animate ? 0 : total);

  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    const start = performance.now();
    
    const duration = Math.min(2000, Math.max(600, total * 3));
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      
      const eased = 1 - Math.pow(1 - p, 2.2);
      setChars(Math.floor(total * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [content, animate]);

  if (!animate || chars >= total) return <MarkdownRenderer content={content} />;
  return <MarkdownRenderer content={content.slice(0, chars) + '\uE000'} />;
};

export const MessageList: React.FC<MessageListProps> = ({
  sessionTitle,
  repoName,
  messages,
  streamingState,
  agentStatus,
  isSidebarOpen,
  onToggleSidebar,
  onOpenRightTab,
  activeRightTab,
  openTabs = [],
  onCloseTab,
  onReRunPrompt,
  lang = 'en',
  hasMoreMessages = false,
  isLoadingOlder = false,
  onLoadOlder,
  editDetails = {},
  onRequestEditsIds,
  isRunning = false,
  animateId = null,
  networkRetry = null,
  sessionId = null,
  inputBar
}) => {
  const t = translations[lang];
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [openThoughts, setOpenThoughts] = useState<Record<string, boolean>>({});
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});
  const [runSeconds, setRunSeconds] = useState(0);
  useEffect(() => {
    if (!isRunning) { setRunSeconds(0); return; }
    const started = Date.now();
    const iv = setInterval(() => setRunSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [isRunning]);
  
  const [isRailExpanded, setIsRailExpanded] = useState<boolean>(() => {
    return localStorage.getItem('magnum_rail_expanded') === 'true';
  });
  const toggleRailExpand = () => {
    setIsRailExpanded(prev => {
      const next = !prev;
      localStorage.setItem('magnum_rail_expanded', String(next));
      return next;
    });
  };
  const [, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t2 = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t2);
  }, []);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomAnchorRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 120);
  };
  
  const prevLastMsgRef = useRef<string | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    scrollToBottom('auto');
    const last = messages.length ? messages[messages.length - 1] : null;
    prevLastMsgRef.current = last ? last.id : null;
    
  }, [sessionId]);
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    const last = messages.length ? messages[messages.length - 1] : null;
    const lastId = last ? last.id : null;
    if (lastId !== prevLastMsgRef.current) {
      
      if (last && last.role === 'user') scrollToBottom('smooth');
      prevLastMsgRef.current = lastId;
    }
    
  }, [messages]);

  const lastUserMsgBefore = (idx: number): ChatMessage | null => {
    for (let i = idx; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i];
    }
    return null;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative', background: 'var(--bg-secondary)' }}>
      {}
      <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isSidebarOpen && (
            <Tooltip content="Show Sidebar" shortcut="Ctrl+B" position="bottom">
              <button
                className="hover-bright"
                onClick={onToggleSidebar}
                style={{ ...headerBtn, color: 'var(--text-dim)', padding: 4 }}
              >
                <PanelLeft size={14} />
              </button>
            </Tooltip>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '4px 10px', maxWidth: 360, minWidth: 0 }}>
            <MessageSquare size={12} color="var(--text-dim)" style={{ flexShrink: 0 }} />
            <span dir="auto" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sessionTitle || 'Conversation'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {activeRightTab === null && (
            <Tooltip content="Open Panel" shortcut="Ctrl Alt B" position="bottom">
              <button
                className="hover-bright"
                onClick={() => {
                  onOpenRightTab(openTabs[openTabs.length - 1] || 'browser');
                }}
                style={{ ...headerBtn, color: 'var(--text-dim)' }}
              >
                <PanelRight size={14} />
              </button>
            </Tooltip>
          )}
          {activeRightTab === null && (
            <Tooltip content={isRailExpanded ? 'Collapse Tabs Rail' : 'Expand Tabs Rail'} position="bottom">
              <button
                onClick={toggleRailExpand}
                className="hover-bright"
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '2px 7px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 4 }}
              >
                <span>{isRailExpanded ? 'Collapse' : 'Expand'}</span>
                {isRailExpanded ? <ChevronsRight size={12} /> : <ChevronsLeft size={12} />}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>
        {}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div ref={containerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 60px' }}>
          <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {hasMoreMessages && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={onLoadOlder}
                  disabled={isLoadingOlder}
                  className="hover-bright"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: isLoadingOlder ? 'wait' : 'pointer' }}
                >
                  {isLoadingOlder ? 'Loading older messages…' : 'Load older messages'}
                </button>
              </div>
            )}
            {messages.map((m, idx) => {
              const skillId = m.role === 'user' ? (m.skill || detectSkillInText(m.text)) : null;
              const cleanText = m.role === 'user' ? stripSkillPrefix(m.text) : m.text;
              return m.role === 'user' ? (
                <div
                  key={m.id}
                  dir="auto"
                  className="msg-bubble selectable-text"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: 13.5,
                    color: 'var(--text-main)',
                    lineHeight: 1.6,
                    position: 'relative',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', minWidth: 0, width: '100%' }}>
                    {skillId && <SkillChip id={skillId} size="sm" />}
                    <span style={{ whiteSpace: 'pre-wrap', flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{cleanText}</span>
                  </div>
                  {onReRunPrompt && (
                    <button
                      className="msg-rerun hover-bright"
                      onClick={() => onReRunPrompt(cleanText, skillId)}
                      title="Re-run prompt"
                      style={{ position: 'absolute', top: 6, insetInlineEnd: 6, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 4 }}
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              ) : (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {m.thought && (
                    <div>
                      <button
                        onClick={() => setOpenThoughts(s => ({ ...s, [m.id]: !s[m.id] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                      >
                        {openThoughts[m.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span style={{ fontWeight: 500 }}>Thought</span>
                      </button>
                      {openThoughts[m.id] && (
                        <div
                          className="selectable-text"
                          style={{ margin: '4px 0 2px 17px', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto' }}
                        >
                          {m.thought}
                        </div>
                      )}
                    </div>
                  )}
                  {(() => {
                    const info = getToolInfo(m, t);
                    if (!info) {
                      const shouldAnimate = m.id === animateId && (Date.now() - (m.ts || 0)) < 5000;
                      return (
                        <div className="selectable-text">
                          {shouldAnimate ? <AnimatedMarkdown content={m.text} /> : <MarkdownRenderer content={m.text} />}
                        </div>
                      );
                    }
                    const hasDetail = info.kind === 'patch' ? !isSuccessfulPatchReport(m) : Boolean(m.text);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button
                          onClick={() => hasDetail && setOpenTools(s => ({ ...s, [m.id]: !s[m.id] }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 12.5, cursor: hasDetail ? 'pointer' : 'default', padding: 0, minWidth: 0 }}
                        >
                          {hasDetail ? (openTools[m.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span style={{ width: 12 }} />}
                          <AgentIcon kind={ACTION_TO_ICON[m.action || ''] || 'think'} color="var(--text-dim)" size={13} />
                          <span style={{ fontWeight: 500, flexShrink: 0 }}>{info.label}</span>
                          {info.meta && (
                            <span className="code-font" style={{ color: 'var(--text-dim)', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 }}>
                              {info.meta}
                            </span>
                          )}
                        </button>
                        {openTools[m.id] && hasDetail && (
                          <div className="selectable-text" style={{ margin: '2px 0 4px 17px', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.7, maxHeight: 260, overflowY: 'auto' }}>
                            <MarkdownRenderer content={m.text} />
                          </div>
                        )}
                        {info.kind === 'patch' && Array.isArray(m.edits) && m.edits.length > 0 && (
                          <div style={{ marginLeft: 17 }}>
                            <EditSummaryRows edits={m.edits} details={editDetails} onRequestIds={onRequestEditsIds} label={t.edited} editsWord={t.editsWord} />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {!getToolInfo(m, t) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, color: 'var(--text-dim)' }}>
                      <ThumbsUp size={13} className="hover-bright" style={{ cursor: 'pointer' }} />
                      <ThumbsDown size={13} className="hover-bright" style={{ cursor: 'pointer' }} />
                      <button onClick={() => handleCopy(m.id, m.text)} className="hover-bright" style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', padding: 2 }}>
                        {copiedId === m.id ? <Check size={13} color="var(--accent-green)" /> : <Copy size={13} />}
                      </button>
                      {onReRunPrompt && (
                        <button onClick={() => {
                          const lu = lastUserMsgBefore(idx);
                          if (lu) onReRunPrompt(stripSkillPrefix(lu.text), lu.skill || detectSkillInText(lu.text));
                        }} className="hover-bright" title="Regenerate" style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', padding: 2 }}>
                          <RotateCcw size={13} />
                        </button>
                      )}
                      <span style={{ fontSize: 11.5, color: 'var(--text-dim)', marginLeft: 4 }}>
                        {formatRelativeAgo(m.ts) || m.timestamp || ''}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {(isRunning || streamingState) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <Loader2 size={13} style={{ animation: 'magnumSpin 1s linear infinite', color: 'var(--accent-green)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {t.workingFor} {formatDuration(runSeconds)}
                  </span>
                  {agentStatus && (
                    <>
                      <span style={{ color: 'var(--text-dim)' }}>·</span>
                      <span className="animate-pulse-slow" dir="auto">{agentStatus}</span>
                    </>
                  )}
                </div>
            {networkRetry && (
              <div dir="auto" style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--warn-text)', fontSize: 12, marginLeft: 21 }}>
                <AgentIcon kind="warn" color="var(--warn-text)" size={13} />
                <span style={{ fontWeight: 600 }}>{t.networkRetryWarn} ({networkRetry.attempt}/{networkRetry.max})</span>
              </div>
            )}
                {streamingState?.thought && !streamingState?.text && (
                  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', color: 'var(--text-dim)', fontSize: 12.5, lineHeight: 1.7, marginLeft: 21 }}>
                    <AgentIcon kind="think" color="var(--text-dim)" size={13} style={{ marginTop: 3 }} />
                    <span className="selectable-text" dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{streamingState.thought}</span>
                  </div>
                )}
                {streamingState?.text && (
                  <div className="selectable-text" style={{ opacity: 0.95, marginLeft: 21 }}>
                    <MarkdownRenderer content={streamingState.text + '\uE000'} />
                  </div>
                )}
              </div>
            )}
            <div ref={bottomAnchorRef} />
          </div>
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, var(--bg-secondary) 85%)', pointerEvents: 'none', zIndex: 6 }} />

        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom('smooth')}
            title="پرش به انتهای چت"
            className="hover-bright"
            style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-green)', border: 'none', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 6px 18px var(--shadow-heavy)', zIndex: 20 }}
          >
            <ArrowDown size={15} />
          </button>
        )}
        </div>

        {inputBar && (
          <div style={{ flexShrink: 0, zIndex: 10 }}>
            {inputBar}
          </div>
        )}
        </div>
        {}
        {activeRightTab === null && (
          <aside style={{
            width: isRailExpanded ? 164 : 42,
            transition: 'width 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            borderLeft: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}>
            {openTabs.length > 0 && (
              isRailExpanded ? (
                <div style={{ padding: '8px 8px 4px' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 700, padding: '0 4px', display: 'block', marginBottom: 4 }}>Open Tabs</span>
                  {openTabs.map(k => {
                    const def = RAIL_TABS.find(r => r.key === k);
                    if (!def) return null;
                    return (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                        <button onClick={() => onOpenRightTab(k)} className="hover-bright" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 11.5, padding: '4px 6px', borderRadius: 6, cursor: 'pointer' }}>
                          {def.icon}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.label}</span>
                        </button>
                        <button onClick={() => onCloseTab && onCloseTab(k)} className="hover-bright" style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, display: 'flex' }}>✕</button>
                      </div>
                    );
                  })}
                  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />
                </div>
              ) : (
                <div style={{ padding: '8px 0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {openTabs.map(k => {
                    const def = RAIL_TABS.find(r => r.key === k);
                    if (!def) return null;
                    return (
                      <Tooltip key={k} content={def.label} position="left">
                        <button onClick={() => onOpenRightTab(k)} className="hover-bright" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-muted)', borderRadius: 6, cursor: 'pointer' }}>
                          {def.icon}
                        </button>
                      </Tooltip>
                    );
                  })}
                  <div style={{ width: 22, height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                </div>
              )
            )}
            {isRailExpanded ? (
              <div style={{ padding: '0 8px 8px' }}>
                <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 700, padding: '0 4px', display: 'block', marginBottom: 4 }}>On {repoName}</span>
                {RAIL_TABS.map(tb => (
                  <button key={tb.key} onClick={() => onOpenRightTab(tb.key)} className="hover-bright" style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 11.5, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', marginBottom: 2 }}>
                    {tb.icon}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tb.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ padding: '0 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {RAIL_TABS.map(tb => (
                  <Tooltip key={tb.key} content={tb.label} position="left">
                    <button onClick={() => onOpenRightTab(tb.key)} className="hover-bright" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--text-muted)', borderRadius: 6, cursor: 'pointer' }}>
                      {tb.icon}
                    </button>
                  </Tooltip>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
