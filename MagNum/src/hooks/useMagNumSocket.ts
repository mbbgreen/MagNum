import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChatMessage, FileNode, SessionMeta, RightPanelTab, Attachment, EditSummary, EditDetail } from '../types';
import { embeddedBrowser } from '../utils/embeddedBrowser';


export async function getBackendPort(): Promise<number> {
  try {
    const port = await invoke<number>('get_backend_port');
    if (port && typeof port === 'number' && port > 0) {
      return port;
    }
  } catch (err) {
    console.warn('[backend-port] Rust command failed:', err);
  }
  return 5454;
}

async function getWsToken(port: number): Promise<string> {
  try {
    const token = await invoke<string>('read_ws_token');
    if (token && typeof token === 'string' && token.length === 64) {
      return token;
    }
  } catch (err) {
    console.warn('[ws-token] Rust command failed, trying HTTP fallback:', err);
  }

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/ws-token`);
    const data = await res.json();
    if (data?.token) return data.token;
  } catch (err) {
    console.warn('[ws-token] HTTP fallback also failed:', err);
  }

  if (import.meta.env.DEV) {
    console.warn('[ws-token] Using empty token in DEV mode — unsafe for production!');
    return '';
  }
  throw new Error('Could not obtain WebSocket token');
}

export function useMagNumSocket(onOpenRightTab: (tab: RightPanelTab) => void) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [accountInfo, setAccountInfo] = useState<{ isLoggedIn: boolean; email?: string }>({ isLoggedIn: false });
  const [activeWorkspace, setActiveWorkspace] = useState<string>('');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingState, setStreamingState] = useState<{ text?: string; thought?: string; action?: string | null } | null>(null);
  const streamingTextRef = useRef<string>('');
const lastErrorRef = useRef<{ text: string; ts: number }>({ text: '', ts: 0 });
  const [animateId, setAnimateId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>('');
const [networkRetry, setNetworkRetry] = useState<{ attempt: number; max: number } | null>(null);
  const [isDeepThink, setIsDeepThink] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<'deepseek' | 'gemini'>('deepseek');
  const [geminiThinking, setGeminiThinkingLevel] = useState<'low' | 'medium' | 'high'>(() => {
    const saved = localStorage.getItem('magnum_gemini_thinking');
    return saved === 'low' || saved === 'high' ? saved : 'medium';
  });
  const geminiThinkingRef = useRef(geminiThinking);
  useEffect(() => { geminiThinkingRef.current = geminiThinking; }, [geminiThinking]);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [pendingPatches, setPendingPatches] = useState<EditSummary[]>([]);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [editDetails, setEditDetails] = useState<Record<number, EditDetail>>({});
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [providersStatus, setProvidersStatus] = useState<{ deepseek: 'disconnected' | 'connecting' | 'connected'; gemini: 'disconnected' | 'connecting' | 'connected' }>({ deepseek: 'disconnected', gemini: 'disconnected' });
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<{ line: string; kind: string; ts: number }[]>([]);
  const [patchHistory, setPatchHistory] = useState<{ file: string; success: boolean; message?: string; ts: number }[]>([]);
  const [termLines, setTermLines] = useState<{ type: 'out' | 'err' | 'echo' | 'sys'; text?: string; cwd?: string; command?: string }[]>([]);
  const [termCwd, setTermCwd] = useState<string>('');
  const pushTerm = (l: any) => setTermLines(prev => { const n = [...prev, l]; return n.length > 2000 ? n.slice(n.length - 2000) : n; });
  const [revertedEditIds, setRevertedEditIds] = useState<number[]>([]);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const selectedFileNameRef = useRef(selectedFileName);
const currentSessionIdRef = useRef<string | null>(currentSessionId);

  useEffect(() => {
    selectedFileNameRef.current = selectedFileName;
  }, [selectedFileName]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retries = 0;
    let disposed = false; 
    let wsToken: string = '';
    let port: number = 5454;

    const initializeAndConnect = async () => {
      try {
        port = await getBackendPort();
        embeddedBrowser.setPort(port);
        wsToken = await getWsToken(port);
      } catch (err) {
        console.error('[ws] Could not get token/port:', err);
      }
      connect();
    };

    const connect = () => {
      if (disposed) return;
      const wsUrl = wsToken
        ? `ws://127.0.0.1:${port}?token=${encodeURIComponent(wsToken)}`
        : `ws://127.0.0.1:${port}`;
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        retries = 0;
        const lang = localStorage.getItem('magnum_lang') === 'fa' ? 'fa' : 'en';
        socket?.send(JSON.stringify({ action: 'set_language', lang }));
        socket?.send(JSON.stringify({ action: 'get_sessions' }));
        socket?.send(JSON.stringify({ action: 'get_terminal_logs' }));
        socket?.send(JSON.stringify({ action: 'get_recent_workspaces' }));
      };
      socket.onmessage = (event) => {
        if (typeof event.data === 'string' && event.data.length > 2_000_000) {
          console.warn('[ws] dropped oversized payload:', event.data.length);
          return;
        }
        const data = JSON.parse(event.data);
        switch (data.event) {
          case 'auth_status':
          case 'logged_in':
            setAccountInfo({ isLoggedIn: data.isLoggedIn ?? true, email: data.email || 'DeepSeek Online' });
            setConnectionStatus(data.isLoggedIn ?? true ? 'connected' : 'disconnected');
            setProvidersStatus(p => ({ ...p, deepseek: (data.isLoggedIn ?? true) ? 'connected' : 'disconnected' }));
            setAgentStatus('');
            break;
          case 'logged_out':
            setAccountInfo({ isLoggedIn: false, email: '' });
            setConnectionStatus('disconnected');
            setProvidersStatus(p => ({ ...p, deepseek: 'disconnected' }));
            break;
          case 'sessions_list':
            setSessions(data.sessions || []);
            if (data.currentSessionId) setCurrentSessionId(data.currentSessionId);
            break;
          case 'chat_reset':
            setMessages([]);
            setStreamingState(null);
            setIsRunning(false);
            setCurrentSessionId(null);
            setSessions(data.sessions || []);
            setAgentStatus('');
            setNetworkRetry(null);
            setPatchHistory([]);
            setPendingPatches([]);
            setPendingCommand(null);
            setRevertedEditIds([]);
            setHasMoreMessages(false);
            setTotalMessageCount(0);
            setIsLoadingOlder(false);
            break;
          case 'session_loaded':
            setCurrentSessionId(data.session?.id || null);
            setMessages(data.session?.messages || []);
            if (data.session?.provider) {
              setSelectedProvider(data.session.provider === 'gemini' ? 'gemini' : 'deepseek');
            }
            setPendingPatches([]);
            setPendingCommand(null);
            setRevertedEditIds([]);
            setTerminalLogs([]);
            setHasMoreMessages(Boolean(data.session?.hasMore));
            setTotalMessageCount(data.session?.totalMessageCount || (data.session?.messages || []).length);
            setIsLoadingOlder(false);
            setNetworkRetry(null);
            break;
          case 'workspace_loaded':
            setActiveWorkspace(data.path);
            setFileTree(data.tree || []);
            break;
          case 'file_content':
            setSelectedFileName(data.filename);
            setSelectedFileContent(data.content);
            onOpenRightTab('files');
            break;
          case 'agent_status':
            setAgentStatus(data.text);
            break;
          case 'network_retry':
            setNetworkRetry({ attempt: data.attempt, max: data.max });
            setAgentStatus(typeof data.text === 'string' ? data.text : `Network error — retrying (${data.attempt}/${data.max})...`);
            break;
          case 'agent_streaming':
            streamingTextRef.current = typeof data.text === 'string' ? data.text : '';
            setStreamingState({
              text: typeof data.text === 'string' ? data.text : '',
              thought: typeof data.thought === 'string' ? data.thought : '',
              action: data.action || null
            });
            setNetworkRetry(null);
            break;
          case 'agent_streaming_end':
            setStreamingState(null);
            break;
          case 'agent_message':
            
            if (data.sessionId && currentSessionIdRef.current && data.sessionId !== currentSessionIdRef.current) {
              console.log('Skipping background message for inactive view:', data.sessionId);
              break;
            }

            const finalText = typeof data.text === 'string' ? data.text : '';
            const commitId = data.msgId ? String(data.msgId) : Math.random().toString(36).substring(2, 9);

            
            if (finalText.length > 5 && (!data.action || data.action === 'finish')) {
              setAnimateId(commitId);
            } else {
              setAnimateId(null);
            }

            streamingTextRef.current = '';
            setMessages(prev => {
              const stableId = data.msgId ? String(data.msgId) : commitId;
              if (prev.some(m => m.id === stableId)) return prev;
              return [...prev, {
                id: stableId,
                role: data.role || 'agent',
                text: data.text,
                thought: data.thought || '',
                action: data.action,
                skill: data.skill || undefined,
                edits: Array.isArray(data.edits) ? data.edits : undefined,
                files: Array.isArray(data.files) ? data.files : undefined,
                file: typeof data.file === 'string' ? data.file : undefined,
                command: typeof data.command === 'string' ? data.command : undefined,
                isError: false,
                ts: data.ts || Date.now(),
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }];
            });
            setStreamingState(null);
            break;
          case 'deep_think_status':
            setIsDeepThink(Boolean(data.enabled));
            break;
          case 'thinking_level':
            if (data.level === 'low' || data.level === 'medium' || data.level === 'high') {
              setGeminiThinkingLevel(data.level);
              localStorage.setItem('magnum_gemini_thinking', data.level);
            }
            break;
          case 'task_finished':
          case 'task_stopped':
            setIsRunning(false);
            setAgentStatus('');
            setStreamingState(null);
            setNetworkRetry(null);
            break;
          case 'error': {
            const errText = String(data.message || '');
            const now = Date.now();
            if (errText === lastErrorRef.current.text && now - lastErrorRef.current.ts < 2000) break;
            lastErrorRef.current = { text: errText, ts: now };
            setIsRunning(false);
            setAgentStatus('');
            setStreamingState(null);
            setNetworkRetry(null);
            setMessages(prev => [...prev, {
              id: Math.random().toString(36).substring(2, 9),
              role: 'agent',
              text: `Error: ${data.message}`,
              isError: true,
              ts: Date.now(),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
            break;
          }
          case 'terminal_log':
            setTerminalLogs(prev => {
              const next = [...prev, { line: data.line, kind: data.kind, ts: data.ts }];
              return next.length > 400 ? next.slice(next.length - 400) : next;
            });
            break;
          case 'terminal_history':
            setTerminalLogs(data.logs || []);
            break;
          case 'recent_workspaces':
            setRecentWorkspaces(data.workspaces || []);
            break;
          case 'embedded_navigate': {
            (async () => {
              try {
                onOpenRightTab('browser');
                await embeddedBrowser.navigate(data.input || '');
                
                setTimeout(() => embeddedBrowser.syncPageContent(), 1200);
                socket?.send(JSON.stringify({
                  action: 'embedded_navigate_ack',
                  url: embeddedBrowser.getActiveUrl()
                }));
              } catch (e: any) {
                socket?.send(JSON.stringify({ action: 'embedded_navigate_ack', error: String(e?.message || e) }));
              }
            })();
            break;
          }
          case 'embedded_read_page': {
            (async () => {
              await embeddedBrowser.syncPageContent();
              socket?.send(JSON.stringify({
                action: 'embedded_read_ack',
                url: embeddedBrowser.getActiveUrl()
              }));
            })();
            break;
          }
          case 'terminal_live_output':
            pushTerm({ type: data.isErr ? 'err' : 'out', text: String(data.line ?? '') });
            break;
          case 'terminal_echo':
            pushTerm({ type: 'echo', cwd: data.cwd || '', command: String(data.command ?? '') });
            break;
          case 'terminal_prompt':
            setTermCwd(typeof data.cwd === 'string' ? data.cwd : '');
            break;
          case 'terminal_clear':
            setTermLines([]);
            break;
          case 'terminal_exit':
            pushTerm({ type: 'sys', text: `[powershell exited — code ${data.code ?? 0}]` });
            break;
          case 'patch_applied':
            setPatchHistory(prev => [...prev, ...(data.details || []).map((d: any) => ({ ...d, ts: Date.now() }))].slice(-60));
            break;
          case 'diagnostic_result':
            setDiagnosticResult(data);
            if (data.ok) setConnectionStatus('connected');
            else if (data.status === 'closed') setConnectionStatus('disconnected');
            break;
          case 'session_purged_remote':
            setSessions(data.sessions || []);
            setCurrentSessionId(null);
            setMessages([]);
            setIsRunning(false);
            setAgentStatus('');
            setStreamingState(null);
            setNetworkRetry(null);
            break;
          case 'sync_completed':
            setSessions(data.sessions || []);
            setAgentStatus(data.message || 'Sync completed.');
            break;
          case 'login_browser_opened':
            setAgentStatus(data.message || 'Browser window is open.');
            if (data.provider === 'gemini') setProvidersStatus(p => ({ ...p, gemini: 'connecting' }));
            else { setProvidersStatus(p => ({ ...p, deepseek: 'connecting' })); setConnectionStatus('connecting'); }
            break;
          case 'providers_status':
            setProvidersStatus({ deepseek: data.deepseek || 'disconnected', gemini: data.gemini || 'disconnected' });
            break;
          case 'gemini_logged_in':
            setProvidersStatus(p => ({ ...p, gemini: 'connected' }));
            break;
          case 'gemini_logged_out':
            setProvidersStatus(p => ({ ...p, gemini: 'disconnected' }));
            break;
          case 'older_messages_loaded':
            setIsLoadingOlder(false);
            setMessages(prev => {
              const older = Array.isArray(data.session?.messages) ? data.session.messages : [];
              const existing = new Set(prev.map(m => m.id));
              const toPrepend = older.filter((m: any) => !existing.has(m.id));
              return [...toPrepend, ...prev];
            });
            setHasMoreMessages(Boolean(data.session?.hasMore));
            if (data.session?.totalMessageCount) setTotalMessageCount(data.session.totalMessageCount);
            break;
          case 'message_edits':
          case 'edits_detail':
            setEditDetails(prev => {
              const next = { ...prev };
              for (const e of (data.edits || [])) next[e.id] = e;
              return next;
            });
            break;
          case 'patch_proposed':
            setPendingPatches(Array.isArray(data.summaries) ? data.summaries : []);
            onOpenRightTab('changes');
            break;
          case 'command_proposed':
            setPendingCommand(typeof data.command === 'string' ? data.command : null);
            onOpenRightTab('changes');
            break;
          case 'command_result':
            setPendingCommand(null);
            break;
          case 'patch_result':
          case 'file_patched':
            setPendingPatches([]);
            if (data.file && data.file === selectedFileNameRef.current) {
              socket?.send(JSON.stringify({ action: 'read_file', filename: data.file }));
            }
            break;
          case 'edits_reverted': {
            const okIds = (data.results || []).filter((r: any) => r.success).map((r: any) => Number(r.id));
            if (okIds.length) setRevertedEditIds(prev => Array.from(new Set([...prev, ...okIds])));
            break;
          }
        }
      };
      socket.onclose = () => {
        if (disposed) return; 
        setConnectionStatus('disconnected');
        setIsRunning(false);
        setAgentStatus('Engine disconnected — reconnecting...');
        retries++;
        const delay = Math.min(500 * retries, 5000);
        setTimeout(initializeAndConnect, delay);
      };
      setWs(socket);
    };
    initializeAndConnect();
    return () => {
      disposed = true;
      if (socket) {
        socket.onmessage = null; 
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  const sendAction = useCallback((action: string, payload: Record<string, any> = {}) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action, ...payload }));
    } else {
      console.warn('[ws] sendAction dropped — socket not open:', action);
    }
  }, [ws]);

  const openWorkspace = useCallback((path: string) => {
    sendAction('open_workspace', { path });
  }, [sendAction]);

  const loadSession = useCallback((id: string) => {
    sendAction('load_session', { sessionId: id });
    const s = sessions.find(x => x.id === id);
    if (s && s.workspacePath && s.workspacePath !== activeWorkspace) {
      openWorkspace(s.workspacePath);
    }
  }, [sendAction, sessions, activeWorkspace, openWorkspace]);

  const setGeminiThinking = useCallback((level: 'low' | 'medium' | 'high') => {
    setGeminiThinkingLevel(level);
    localStorage.setItem('magnum_gemini_thinking', level);
    sendAction('set_thinking_level', { level });
  }, [sendAction]);

  const sendPrompt = useCallback((
    promptText: string,
    autoApplyPatch: boolean,
    excludedPaths: string[],
    ignoredPatterns: string[],
    attachments: Attachment[] = [],
    skillId: string | null = null,
    autoApproveCommand: boolean = false
  ) => {
    if ((!promptText.trim() && attachments.length === 0) || isRunning) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        role: 'agent',
        text: 'Error: Engine disconnected. Reconnecting to backend... please try again in a moment.',
        isError: true,
        ts: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setAgentStatus('Engine disconnected — reconnecting...');
      return;
    }
    const userMsgId = Math.random().toString(36).substring(2, 9);
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      text: promptText,
      skill: skillId || undefined,
      attachments,
      ts: Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setIsRunning(true);
    setAgentStatus('Uploading context & planning next moves...');
    sendAction('send_prompt', {
      prompt: promptText,
      provider: selectedProvider,
      thinkingLevel: geminiThinkingRef.current,
      deepThink: isDeepThink,
      autoApplyPatch,
      autoApproveCommand,
      excludedPaths,
      ignoredPatterns,
      attachments,
      skill: skillId || undefined
    });
  }, [isRunning, isDeepThink, selectedProvider, sendAction, ws]);

  const loadOlderMessages = useCallback(() => {
    if (!currentSessionId || isLoadingOlder || !hasMoreMessages) return;
    setIsLoadingOlder(true);
    sendAction('load_older_messages', { sessionId: currentSessionId, limit: 30, offset: messages.length });
  }, [currentSessionId, isLoadingOlder, hasMoreMessages, messages.length, sendAction]);

  const requestMessageEdits = useCallback((messageId: number) => sendAction('get_message_edits', { messageId }), [sendAction]);
  const requestEditsIds = useCallback((ids: number[]) => sendAction('get_edits_detail', { editIds: ids }), [sendAction]);
  const sendTerminalInput = useCallback((text: string) => sendAction('terminal_input', { text }), [sendAction]);
  const sendTerminalInterrupt = useCallback(() => sendAction('terminal_interrupt'), [sendAction]);
  const sendTerminalRestart = useCallback(() => sendAction('terminal_restart'), [sendAction]);

  return {
    accountInfo,
    activeWorkspace,
    fileTree,
    selectedFileName,
    selectedFileContent,
    messages,
    streamingState,
    isRunning,
    networkRetry,
    agentStatus,
    isDeepThink,
    setIsDeepThink,
    selectedProvider,
    setSelectedProvider,
    sessions,
    currentSessionId,
    pendingPatches,
    pendingCommand,
    setPendingCommand,
    editDetails,
    terminalLogs,
    patchHistory,
    diagnosticResult,
    connectionStatus,
    providersStatus,
    geminiThinking,
    setGeminiThinking,
    recentWorkspaces,
    sendAction,
    sendPrompt,
    loadSession,
    openWorkspace,
    hasMoreMessages,
    totalMessageCount,
    isLoadingOlder,
    loadOlderMessages,
    requestMessageEdits,
    requestEditsIds,
    revertedEditIds,
    animateId,
    termLines,
    termCwd,
    sendTerminalInput,
    sendTerminalInterrupt,
    sendTerminalRestart
  };
}
