import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RightPanelTab } from './types';
import { Language } from './i18n/translations';
import { useMagNumSocket } from './hooks/useMagNumSocket';
import { TopMenuBar } from './components/layout/TopMenuBar';
import { confirmDialog, AppDialogHost } from './components/modals/AppDialog';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { EmptyState } from './components/chat/EmptyState';
import { MessageList } from './components/chat/MessageList';
import { ChatInputBar } from './components/chat/ChatInputBar';
import { InspectorDrawer } from './components/inspector/InspectorDrawer';
import { stripSkillPrefix } from './utils/skills';
import { FilterModal } from './components/modals/FilterModal';
import { SettingsView } from './components/settings/SettingsView';
import { UpdateGate } from './components/update/UpdateGate';

import './App.css';

export default function App() {
  type PanelKey = Exclude<RightPanelTab, null>;



  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>(null);
  const [openTabs, setOpenTabs] = useState<PanelKey[]>([]);
  const openTabsRef = useRef<PanelKey[]>([]);
  useEffect(() => { openTabsRef.current = openTabs; }, [openTabs]);

  
  const openRightTab = useCallback((tb: PanelKey) => {
    setOpenTabs(prev => (prev.includes(tb) ? prev : [...prev, tb]));
    setRightPanelTab(tb);
  }, []);

  
  const closeRightTab = useCallback((tb: PanelKey) => {
    const next = openTabsRef.current.filter(x => x !== tb);
    openTabsRef.current = next;
    setOpenTabs(next);
    setRightPanelTab(cur => (cur === tb ? (next[next.length - 1] ?? null) : cur));
  }, []);

  
  const toggleRightPanel = useCallback(() => {
    if (rightPanelTab !== null) {
      setRightPanelTab(null);
    } else {
      const target = openTabsRef.current[openTabsRef.current.length - 1] || 'browser';
      openRightTab(target);
    }
  }, [rightPanelTab, openRightTab]);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoApplyPatch, setAutoApplyPatch] = useState<boolean>(() => {
    const saved = localStorage.getItem('magnum_autopatch');
    return saved === null ? true : saved === '1';
  });
  useEffect(() => {
    localStorage.setItem('magnum_autopatch', autoApplyPatch ? '1' : '0');
  }, [autoApplyPatch]);
  const [requireCommandApproval, setRequireCommandApproval] = useState<boolean>(() => {
    const saved = localStorage.getItem('magnum_cmdapproval');
    return saved === null ? true : saved === '1'; 
  });
  useEffect(() => {
    localStorage.setItem('magnum_cmdapproval', requireCommandApproval ? '1' : '0');
  }, [requireCommandApproval]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('magnum_lang') as Language) || 'en';
  });

const [theme, setTheme] = useState<'dark' | 'light'>(() => {
  return localStorage.getItem('magnum_theme') === 'light' ? 'light' : 'dark';
});

  const [ignoredPatterns, setIgnoredPatterns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('magnum_ignored_list');
      return saved ? JSON.parse(saved) : ['node_modules', '.git', 'dist', 'build', '.next'];
    } catch {
      return ['node_modules', '.git', 'dist', 'build', '.next'];
    }
  });

  const {
    activeWorkspace,
    fileTree,
    selectedFileName,
    selectedFileContent,
    messages,
    streamingState,
    isRunning,
    agentStatus,
    isDeepThink,
    setIsDeepThink,
    selectedProvider,
    setSelectedProvider,
    sessions,
    currentSessionId,
    pendingPatches,
    pendingCommand,
    editDetails,
    terminalLogs,
    patchHistory,
    diagnosticResult,
    providersStatus,
    recentWorkspaces,
    sendAction,
    sendPrompt,
    loadSession,
    openWorkspace,
    hasMoreMessages,
    isLoadingOlder,
    loadOlderMessages,
    requestEditsIds,
    revertedEditIds,
    animateId,
    networkRetry,
    geminiThinking,
    setGeminiThinking,
    termLines,
    termCwd,
    sendTerminalInput,
    sendTerminalInterrupt,
    sendTerminalRestart
  } = useMagNumSocket((tab) => { if (tab) openRightTab(tab); });

  const cycleGeminiThinking = useCallback(() => {
    const order: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    setGeminiThinking(order[(order.indexOf(geminiThinking) + 1) % 3]);
  }, [geminiThinking, setGeminiThinking]);

  const repoName = activeWorkspace ? activeWorkspace.split(/[\\/]/).filter(Boolean).pop() || activeWorkspace : 'No Repo';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('magnum_theme', theme);
    
    try {
      invoke('set_app_theme', { theme }).catch(() => {});
    } catch {}
  }, [theme]);

  useEffect(() => {
    sendAction('set_language', { lang: language });
  }, [language, sendAction]);

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    localStorage.setItem('magnum_lang', newLang);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
      
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); openRightTab('files'); }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'j' || e.key === 'J')) { e.preventDefault(); openRightTab('terminal'); }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); openRightTab('changes'); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); openRightTab('browser'); }
      
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleRightPanel();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rightPanelTab, messages.length, streamingState, toggleRightPanel, openRightTab]);



  return (
    <UpdateGate>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      
<TopMenuBar
  activeWorkspace={activeWorkspace}
  isSidebarOpen={isSidebarOpen}
  onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
  onNewChat={() => sendAction('new_chat')}
  onOpenFolder={() => sendAction('choose_folder')}
  onToggleTab={(t) => { if (rightPanelTab === t) setRightPanelTab(null); else openRightTab(t); }}
  onOpenFilters={() => setIsSettingsOpen(true)}
  onDiagnose={() => sendAction('diagnose')}
/>

      {isSettingsOpen ? (
        <SettingsView
          provider={selectedProvider}
          geminiThinking={geminiThinking}
          onGeminiThinkingChange={setGeminiThinking}
          currentLang={language}
          onLanguageChange={handleLanguageChange}
          currentTheme={theme}
          onThemeChange={setTheme}
          isDeepThink={isDeepThink}
          onToggleDeepThink={() => {
            setIsDeepThink(!isDeepThink);
            sendAction('set_deep_think', { enabled: !isDeepThink });
          }}
          autoApplyPatch={autoApplyPatch}
          onToggleAutoPatch={() => setAutoApplyPatch(!autoApplyPatch)}
          requireCommandApproval={requireCommandApproval}
          onToggleCommandApproval={() => setRequireCommandApproval(!requireCommandApproval)}
          onClose={() => setIsSettingsOpen(false)}
           onRunDiagnostic={() => sendAction('diagnose')}
           diagnosticResult={diagnosticResult}
         />
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          
          {isSidebarOpen && (
            <LeftSidebar
              activeWorkspace={activeWorkspace}
              sessions={sessions}
              currentSessionId={currentSessionId}

              recentWorkspaces={recentWorkspaces}
              onNewChat={() => sendAction('new_chat')}
              onOpenFolder={() => sendAction('choose_folder')}
              onOpenWorkspace={(p) => openWorkspace(p)}
              onStartScratch={() => sendAction('start_scratch')}
              onOpenFilters={() => setIsSettingsOpen(true)}
              onLoadSession={(id) => loadSession(id)}
              onDeleteSession={(id) => sendAction('delete_session', { sessionId: id })}
              onDiagnose={() => setIsSettingsOpen(true)}
              onToggleSidebar={() => setIsSidebarOpen(false)}
            />
          )}

          <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', overflow: 'hidden', position: 'relative' }}>
            {messages.length === 0 && !streamingState ? (
              <EmptyState
                repoName={repoName}
                activeWorkspace={activeWorkspace}
                recentWorkspaces={recentWorkspaces}
                onOpenWorkspace={(p) => openWorkspace(p)}
                onStartScratch={() => sendAction('start_scratch')}
                isDeepThink={isDeepThink}
                autoApplyPatch={autoApplyPatch}
                onToggleDeepThink={() => {
                  setIsDeepThink(!isDeepThink);
                  sendAction('set_deep_think', { enabled: !isDeepThink });
                }}
                onToggleAutoPatch={() => setAutoApplyPatch(!autoApplyPatch)}
                onOpenFolder={() => sendAction('choose_folder')}
                onSubmit={(text, attachments, skillId) => sendPrompt(text, autoApplyPatch, [], ignoredPatterns, attachments, skillId, !requireCommandApproval)}
                onOpenIDE={() => sendAction('open_workspace_explorer')}
                activeRightTab={rightPanelTab}
                onTogglePanel={toggleRightPanel}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
                selectedProvider={selectedProvider}
                onSelectProvider={setSelectedProvider}
                geminiThinking={geminiThinking}
                onCycleThinking={cycleGeminiThinking}
                providers={providersStatus}
                onConnectProvider={(p) => sendAction(p === 'gemini' ? 'connect_gemini' : 'open_browser')}
                onShowProvider={(p) => sendAction('show_provider_browser', { provider: p })}
                onHideProvider={(p) => sendAction('hide_provider_browser', { provider: p })}
                onDisconnectProvider={async (p) => {
                  const ok = await confirmDialog({
                    title: p === 'gemini' ? 'Disconnect Gemini' : 'Disconnect DeepSeek',
                    message: p === 'gemini'
                      ? 'Disconnect Gemini? The saved Google profile is kept for fast reconnect.'
                      : 'Disconnect from DeepSeek? Your saved login profile will be kept, so the app reconnects automatically next time.',
                    confirmLabel: 'Disconnect',
                    cancelLabel: 'Cancel',
                    danger: true
                  });
                  if (ok) sendAction(p === 'gemini' ? 'logout_gemini' : 'logout');
                }}
                providerLocked={Boolean(currentSessionId)}
              />
            ) : (
              <MessageList
                  sessionTitle={stripSkillPrefix(messages[0]?.text || '').slice(0, 30) || 'Project overview insights'}
                  repoName={repoName}
                  messages={messages}
                  streamingState={streamingState}
                  agentStatus={agentStatus}
                  isSidebarOpen={isSidebarOpen}
                  onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
                  onOpenRightTab={(tab) => { if (tab) openRightTab(tab); else setRightPanelTab(null); }}
                  activeRightTab={rightPanelTab}
                  openTabs={openTabs}
                  onCloseTab={closeRightTab}
                  onReRunPrompt={(text, skillId) => sendPrompt(text, autoApplyPatch, [], ignoredPatterns, [], skillId || null, !requireCommandApproval)}
                   onOpenIDE={() => sendAction('open_workspace_explorer')}
                   lang={language}
                   hasMoreMessages={hasMoreMessages}
                   isLoadingOlder={isLoadingOlder}
                   onLoadOlder={loadOlderMessages}
                   editDetails={editDetails}
                   onRequestEditsIds={requestEditsIds}
isRunning={isRunning}
                    animateId={animateId}
                    networkRetry={networkRetry}
                    sessionId={currentSessionId}
                    inputBar={
                      <ChatInputBar
                        isRunning={isRunning}
                        isDeepThink={isDeepThink}
                        provider={selectedProvider}
                        geminiThinking={geminiThinking}
                        onCycleThinking={cycleGeminiThinking}
                        onToggleDeepThink={() => {
                          setIsDeepThink(!isDeepThink);
                          sendAction('set_deep_think', { enabled: !isDeepThink });
                        }}
                        onSend={(text, attachments) => sendPrompt(text, autoApplyPatch, [], ignoredPatterns, attachments, null, !requireCommandApproval)}
                        onStop={() => sendAction('stop_task')}
                        onOpenFolder={() => sendAction('choose_folder')}
                        onShowBrowser={() => sendAction('show_provider_browser', { provider: selectedProvider })}
                        onHideBrowser={() => sendAction('hide_provider_browser', { provider: selectedProvider })}
                      />
                    }
                 />
            )}
          </main>

          <InspectorDrawer
            tab={rightPanelTab}
            openTabs={openTabs}
            onSelectTab={(k) => setRightPanelTab(k)}
            onCloseTab={closeRightTab}
            onAddTab={openRightTab}
            pendingPatches={pendingPatches}
            pendingCommand={pendingCommand}
            editDetails={editDetails}
            onRequestEditsIds={requestEditsIds}
            messages={messages}
            revertedIds={revertedEditIds}
            onRevertEdits={(ids) => sendAction('revert_edits', { editIds: ids })}
            terminalLogs={terminalLogs}
            patchHistory={patchHistory}
            fileTree={fileTree}
            selectedFileName={selectedFileName}
            selectedFileContent={selectedFileContent}
            agentStatus={agentStatus}
            isRunning={isRunning}
            onClose={() => setRightPanelTab(null)}
            onApprovePatch={() => sendAction('approve_patch')}
            onRejectPatch={() => sendAction('reject_patch')}
            onApproveCommand={() => sendAction('approve_command')}
            onRejectCommand={() => sendAction('reject_command')}
            onOpenFile={(name) => sendAction('read_file', { filename: name })}
            onOpenBrowser={() => sendAction('open_browser')}
            lang={language}
            termLines={termLines}
            termCwd={termCwd}
            onTerminalInput={sendTerminalInput}
            onTerminalInterrupt={sendTerminalInterrupt}
            onTerminalRestart={sendTerminalRestart}
          />
        </div>
      )}

      <FilterModal
        isOpen={isFilterModalOpen}
        ignoredPatterns={ignoredPatterns}
        onClose={() => setIsFilterModalOpen(false)}
        onUpdateFilters={(list) => {
          setIgnoredPatterns(list);
          localStorage.setItem('magnum_ignored_list', JSON.stringify(list));
          sendAction('update_ignored_list', { ignored: list, path: activeWorkspace });
        }}
      />
      <AppDialogHost />
    </div>
    </UpdateGate>
  );
}
