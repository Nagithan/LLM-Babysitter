export interface FileNode {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  hasSubdirectories?: boolean;
  children?: FileNode[];
}

export interface Preset {
  id: string;
  name: string;
  content: string;
  type: 'prePrompt' | 'instruction' | 'postPrompt';
}

export interface AppState {
  prePrompt: string;
  instruction: string;
  postPrompt: string;
  selectedFiles: string[];
  favorites: Preset[];
  translations: Record<string, string>;
  lastPrePromptId?: string | null;
  lastPostPromptId?: string | null;
}

export enum IpcMessageId {
  READY = 'ready',
  SAVE_PRESET = 'savePreset',
  DELETE_PRESET = 'deletePreset',
  COPY_TO_CLIPBOARD = 'copyToClipboard',
  UPDATE_SELECTION = 'updateSelection',
  UPDATE_TEXT = 'updateText',
  GET_TOKENS = 'getTokens',
  EXPAND_FOLDER = 'expandFolder',
  COPY_TO_CLIPBOARD_RAW = 'copyToClipboardRaw',
  MANAGE_PRESET = 'managePreset',
  SET_SELECTED_PRESET = 'setSelectedPreset'
}

export type WebviewMessage = 
  | { type: IpcMessageId.READY }
  | { type: IpcMessageId.SAVE_PRESET; payload: Preset }
  | { type: IpcMessageId.DELETE_PRESET; payload: string }
  | { type: IpcMessageId.COPY_TO_CLIPBOARD; payload: { prePrompt: string; instruction: string; postPrompt: string; selectedFiles: string[] } }
  | { type: IpcMessageId.UPDATE_SELECTION; payload: string[] }
  | { type: IpcMessageId.UPDATE_TEXT; payload: { type: 'prePrompt' | 'instruction' | 'postPrompt'; text: string } }
  | { type: IpcMessageId.GET_TOKENS; payload: { text: string; selectedFiles: string[] } }
  | { type: IpcMessageId.COPY_TO_CLIPBOARD_RAW; payload: string }
  | { type: IpcMessageId.EXPAND_FOLDER; payload: string }
  | { type: IpcMessageId.MANAGE_PRESET; payload: { id: string; type: 'prePrompt' | 'instruction' | 'postPrompt'; currentText: string } }
  | { type: IpcMessageId.SET_SELECTED_PRESET; payload: { type: 'prePrompt' | 'postPrompt'; id: string | null } };

export type ExtensionMessage = 
  | { type: 'initState'; payload: AppState & { fileTree: FileNode[] } }
  | { type: 'stateUpdate'; payload: Partial<AppState> }
  | { type: 'statusUpdate'; payload: { status: 'success' | 'error'; message: string } }
  | { type: 'folderChildren'; payload: { parentPath: string; children: FileNode[] } }
  | { type: 'tokenUpdate'; payload: { total: number; prompts: number; files: number } }
  | { type: 'expandAll' }
  | { type: 'collapseAll' };
