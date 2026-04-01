import * as vscode from 'vscode';
import { AppState, WebviewMessage, ExtensionMessage, FileNode, Preset, IpcMessageId } from '../types/index.js';
import { LocaleManager } from '../i18n/LocaleManager.js';
import { FileManager } from '../core/FileManager.js';
import { PresetManager } from '../core/PresetManager.js';
import { Logger } from '../core/Logger.js';
import { IWebviewAccess } from '../ipc/handlers/IWebviewAccess.js';
import { IpcMessageRouter } from '../ipc/IpcMessageRouter.js';
import { WebviewHtmlFactory } from './WebviewHtmlFactory.js';

// Import All Handlers
import { ReadyHandler } from '../ipc/handlers/ReadyHandler.js';
import { SavePresetHandler } from '../ipc/handlers/SavePresetHandler.js';
import { DeletePresetHandler } from '../ipc/handlers/DeletePresetHandler.js';
import { UpdateSelectionHandler } from '../ipc/handlers/UpdateSelectionHandler.js';
import { CopyToClipboardHandler } from '../ipc/handlers/CopyToClipboardHandler.js';
import { GetTokensHandler } from '../ipc/handlers/GetTokensHandler.js';
import { ExpandFolderHandler } from '../ipc/handlers/ExpandFolderHandler.js';
import { CopyToClipboardRawHandler } from '../ipc/handlers/CopyToClipboardRawHandler.js';
import { ManagePresetHandler } from '../ipc/handlers/ManagePresetHandler.js';
import { SetSelectedPresetHandler } from '../ipc/handlers/SetSelectedPresetHandler.js';
import { UpdateTextHandler } from '../ipc/handlers/UpdateTextHandler.js';

/**
 * Distinguished Webview Provider for Backseat Pilot.
 * Responsibility: Orchestrates view lifecycle, state management, and IPC delegation.
 * This class adheres to SRP by delegating HTML generation to WebviewHtmlFactory
 * and IPC routing to IpcMessageRouter.
 */
export class BackseatPilotViewProvider implements vscode.WebviewViewProvider, IWebviewAccess {
    public static readonly viewType = 'backseat-pilot-view';
    private _view?: vscode.WebviewView;
    private presetManager: PresetManager;
    private ipcRouter: IpcMessageRouter;
    private logger = Logger.getInstance();

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        this.presetManager = new PresetManager(context);
        this.ipcRouter = new IpcMessageRouter();
        this.initializeHandlers();
    }

    /**
     * Bootstraps the IPC handler registry.
     */
    private initializeHandlers(): void {
        this.ipcRouter.register(IpcMessageId.READY, new ReadyHandler(this));
        this.ipcRouter.register(IpcMessageId.SAVE_PRESET, new SavePresetHandler(this, this.presetManager));
        this.ipcRouter.register(IpcMessageId.DELETE_PRESET, new DeletePresetHandler(this, this.presetManager));
        this.ipcRouter.register(IpcMessageId.UPDATE_SELECTION, new UpdateSelectionHandler(this));
        this.ipcRouter.register(IpcMessageId.COPY_TO_CLIPBOARD, new CopyToClipboardHandler(this));
        this.ipcRouter.register(IpcMessageId.GET_TOKENS, new GetTokensHandler(this));
        this.ipcRouter.register(IpcMessageId.EXPAND_FOLDER, new ExpandFolderHandler(this));
        this.ipcRouter.register(IpcMessageId.COPY_TO_CLIPBOARD_RAW, new CopyToClipboardRawHandler(this));
        this.ipcRouter.register(IpcMessageId.MANAGE_PRESET, new ManagePresetHandler(this, this.presetManager));
        this.ipcRouter.register(IpcMessageId.SET_SELECTED_PRESET, new SetSelectedPresetHandler(this));
        this.ipcRouter.register(IpcMessageId.UPDATE_TEXT, new UpdateTextHandler());
    }

    /**
     * Resolves the webview view and wires up the unified IPC bridge.
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;

        webviewView.onDidDispose(() => {
            if (this._view === webviewView) {
                this._view = undefined;
            }
        }, null, this.context.subscriptions);

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')
            ],
        };

        webviewView.webview.html = WebviewHtmlFactory.getHtml(webviewView.webview, this._extensionUri);

        // Modular IPC delegation bridge
        webviewView.webview.onDidReceiveMessage(async (data: WebviewMessage) => {
            try {
                if (data.type === 'ready') {
                    await this.presetManager.load();
                }
                await this.ipcRouter.handleMessage(data);
            } catch (error: any) {
                this.logger.error(`Unified IPC Bridge Error: ${error.message}`);
                this.sendStatus('error', LocaleManager.getTranslation('status.error'));
            }
        });
    }

    /**
     * Refresh the UI manually.
     */
    public async refresh(): Promise<void> {
        await this.sendInitialState();
    }

    /**
     * Synchronizes the full application state with the webview.
     */
    public async sendInitialState(): Promise<void> {
        if (!this._view) {
            return;
        }

        const fileTree = await FileManager.getRoots();
        const favorites = this.presetManager.getPresets();
        const translations = LocaleManager.getTranslations();
        const selectedFiles = this.getSavedSelection();
        const lastPrePromptId = this.getSavedPresetId('prePrompt');
        const lastPostPromptId = this.getSavedPresetId('postPrompt');

        const state: AppState & { fileTree: FileNode[] } = {
            prePrompt: '',
            instruction: '',
            postPrompt: '',
            selectedFiles,
            favorites,
            translations,
            fileTree,
            lastPrePromptId,
            lastPostPromptId
        };

        this._view.webview.postMessage({ type: 'initState', payload: state });
    }

    /**
     * Dispatches a message to the direct webview instance.
     */
    public postMessage(message: ExtensionMessage): void {
        this._view?.webview.postMessage(message);
    }

    /**
     * Sends a partial state update to the webview for efficient UI syncing.
     */
    public sendPartialUpdate(payload: Partial<AppState>): void {
        this.postMessage({ type: 'stateUpdate', payload });
    }

    /**
     * Persists template selection IDs in workspace state.
     */
    public savePresetId(type: 'prePrompt' | 'postPrompt', id: string | null): void {
        this.context.workspaceState.update(`backseat-pilot.last-${type}-id`, id);
        const key = type === 'prePrompt' ? 'lastPrePromptId' : 'lastPostPromptId';
        this.sendPartialUpdate({ [key]: id });
    }
    
    private getSavedPresetId(type: 'prePrompt' | 'postPrompt'): string | null {
        return this.context.workspaceState.get(`backseat-pilot.last-${type}-id`) || null;
    }

    /**
     * Sends formatted status updates to the UI.
     */
    public sendStatus(status: 'success' | 'error', message: string): void {
        this.postMessage({ type: 'statusUpdate', payload: { status, message } });
    }

    /**
     * Persistence layer for file selections.
     */
    public saveSelection(selection: string[]): void {
        this.context.workspaceState.update('selectedFiles', selection);
        this.sendPartialUpdate({ selectedFiles: selection });
    }
    
    private getSavedSelection(): string[] {
        const selection = this.context.workspaceState.get('selectedFiles');
        return Array.isArray(selection) ? selection : [];
    }
    
    public expandAll(): void {
        this.postMessage({ type: 'expandAll' });
    }
    
    public collapseAll(): void {
        this.postMessage({ type: 'collapseAll' });
    }
}
