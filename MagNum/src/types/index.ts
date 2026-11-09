export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  base64: string;
}

export interface EditSummary { id: number; file: string; added: number; deleted: number; status?: string; }
export interface DiffLineData { type: 'add' | 'del' | 'ctx'; text: string; }
export interface EditDetail { id: number; file: string; status?: string; added: number; deleted: number; truncated?: boolean; diff: DiffLineData[]; }

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  skill?: string;
  thought?: string;
  action?: string;
  isError?: boolean;
  timestamp?: string;
  ts?: number;
  attachments?: Attachment[];
  edits?: EditSummary[];
  files?: string[];
  file?: string;
  command?: string;
}

export interface FileNode {
  name: string;
  relPath: string;
  isDir: boolean;
  children?: FileNode[];
}

export type ModelProvider = 'deepseek' | 'gemini';

export interface SessionMeta {
  id: string;
  title: string;
  updatedAt: string;
  workspacePath?: string;
  provider?: ModelProvider;
}

export interface PatchProposal {
  file: string;
  search?: string;
  replace?: string;
}

export type RightPanelTab = 'changes' | 'browser' | 'terminal' | 'files' | null;

export interface BrowserViewState {
  url: string;
  title: string;
  isLoading: boolean;
  viewport?: { width: number; height: number };
  screenshot: string | null;
  textPreview?: string;
}
