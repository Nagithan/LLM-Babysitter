import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { LLMBabysitterViewProvider } from '../../../webview/LLMBabysitterViewProvider.js';
import { FileManager } from '../../../core/FileManager.js';
import { PresetManager } from '../../../core/PresetManager.js';
import { LocaleManager } from '../../../i18n/LocaleManager.js';
import { WebviewHtmlFactory } from '../../../webview/WebviewHtmlFactory.js';
import { IpcMessageRouter } from '../../../ipc/IpcMessageRouter.js';
import { Logger } from '../../../core/Logger.js';
import { GetTokensHandler } from '../../../ipc/handlers/GetTokensHandler.js';
import { Mock } from 'vitest';
import { TestUtils } from '../../testUtils.js';
import { IpcMessageId, WebviewMessage } from '../../../types/index.js';

describe('LLMBabysitterViewProvider', () => {
    let mockContext: vscode.ExtensionContext;
    interface MockView {
        webview: { 
            postMessage: Mock; 
            onDidReceiveMessage: Mock; 
            html: string; 
            options: { enableScripts: boolean; localResourceRoots: vscode.Uri[] };
            cspSource: string;
        };
        onDidDispose: Mock;
    }
    let mockView: MockView;
    let provider: LLMBabysitterViewProvider;
    let mockLogger: { info: Mock; error: Mock; warn: Mock };
    let mockRouter: { register: Mock; handleMessage: Mock };

    beforeEach(async () => {
        await TestUtils.fullReset();

        // Mock Internal Dependencies
        vi.spyOn(FileManager, 'getRoots').mockResolvedValue([]);
        vi.spyOn(FileManager, 'resolveDisplayPath').mockImplementation((p: string) => vscode.Uri.file('/fake/' + p));
        vi.spyOn(PresetManager.prototype, 'getPresets').mockReturnValue([]);
        vi.spyOn(LocaleManager, 'getTranslations').mockReturnValue({});
        vi.spyOn(LocaleManager, 'getTranslation').mockReturnValue('mocked-translation');
        vi.spyOn(WebviewHtmlFactory, 'getHtml').mockReturnValue('<html></html>');
        
        // Router and Logger
        mockRouter = {
            register: vi.fn(),
            handleMessage: vi.fn().mockResolvedValue(undefined)
        };
        vi.spyOn(IpcMessageRouter.prototype, 'register').mockImplementation(mockRouter.register);
        vi.spyOn(IpcMessageRouter.prototype, 'handleMessage').mockImplementation(mockRouter.handleMessage);
        
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn()
        };
        vi.spyOn(Logger, 'getInstance').mockReturnValue(mockLogger as unknown as Logger);

        mockContext = {
            subscriptions: [],
            extensionUri: vscode.Uri.parse('file:///fake'),
            globalStorageUri: vscode.Uri.parse('file:///fake-storage'),
            workspaceState: {
                get: vi.fn(),
                update: vi.fn().mockResolvedValue(undefined)
            },
            globalState: {
                get: vi.fn(),
                update: vi.fn().mockResolvedValue(undefined)
            }
        } as unknown as vscode.ExtensionContext;

        mockView = {
            webview: {
                options: {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.parse('file:///fake')]
                },
                html: '',
                postMessage: vi.fn().mockResolvedValue(undefined),
                onDidReceiveMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                cspSource: 'vscode-resource:',
                onDidDispose: vi.fn()
            },
            onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() })
        } as unknown as MockView;

        provider = new LLMBabysitterViewProvider(
            mockContext.extensionUri,
            mockContext
        );
    });

    describe('constructor', () => {
        it('registers all necessary IPC handlers', () => {
            const expectedHandlers = [
                IpcMessageId.READY,
                IpcMessageId.SET_SELECTED_PRESET,
                IpcMessageId.GET_TOKENS,
                IpcMessageId.COPY_TO_CLIPBOARD,
                IpcMessageId.COPY_TO_CLIPBOARD_RAW,
                IpcMessageId.UPDATE_SELECTION,
                IpcMessageId.EXPAND_FOLDER,
                IpcMessageId.SAVE_PRESET,
                IpcMessageId.DELETE_PRESET,
                IpcMessageId.UPDATE_TEXT,
                IpcMessageId.MANAGE_PRESET
            ];
            
            expectedHandlers.forEach(id => {
                expect(mockRouter.register).toHaveBeenCalledWith(id, expect.any(Object));
            });
            
            expect(mockRouter.register).toHaveBeenCalledTimes(expectedHandlers.length);
        });
    });

    describe('resolveWebviewView', () => {
        const cancellationToken = { 
            isCancellationRequested: false, 
            onCancellationRequested: vi.fn() 
        } as unknown as vscode.CancellationToken;

        it('sets webview options correctly', () => {
            provider.resolveWebviewView(mockView as unknown as vscode.WebviewView, {} as unknown as vscode.WebviewViewResolveContext, cancellationToken);
            expect(mockView.webview!.options!.enableScripts).toBe(true);
            expect(mockView.webview!.options!.localResourceRoots).toContainEqual(mockContext.extensionUri);
        });

        it('injects HTML into webview', () => {
            provider.resolveWebviewView(mockView as unknown as vscode.WebviewView, {} as unknown as vscode.WebviewViewResolveContext, cancellationToken);
            expect(mockView.webview!.html).toBe('<html></html>');
        });

        it('clears view reference on dispose', () => {
            provider.resolveWebviewView(mockView as unknown as vscode.WebviewView, {} as unknown as vscode.WebviewViewResolveContext, cancellationToken);
            const disposeCallback = vi.mocked(mockView.onDidDispose).mock.calls[0][0];
            
            disposeCallback();
            
            provider.postMessage({ type: 'expandAll' });
            expect(mockView.webview!.postMessage).not.toHaveBeenCalled();
        });

        it('delegates messages to ipcRouter', async () => {
            provider.resolveWebviewView(mockView as unknown as vscode.WebviewView, {} as unknown as vscode.WebviewViewResolveContext, cancellationToken);
            const messageHandler = vi.mocked(mockView.webview.onDidReceiveMessage).mock.calls[0][0];
            
            const message = { type: IpcMessageId.READY };
            await messageHandler(message);
            
            expect(mockRouter.handleMessage).toHaveBeenCalledWith(message);
        });

        it('handles router errors gracefully', async () => {
            provider.resolveWebviewView(mockView as unknown as vscode.WebviewView, {} as unknown as vscode.WebviewViewResolveContext, cancellationToken);
            const messageHandler = vi.mocked(mockView.webview.onDidReceiveMessage).mock.calls[0][0];
            
            const error = new Error('boom');
            vi.mocked(mockRouter.handleMessage).mockRejectedValue(error);
            
            await messageHandler({ type: 'ready' } as unknown as WebviewMessage);
            
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
            expect(mockView.webview!.postMessage).toHaveBeenCalledWith(expect.objectContaining({ 
                type: 'statusUpdate', 
                payload: expect.objectContaining({ status: 'error' }) 
            }));
        });
    });

    describe('sendInitialState', () => {
        it('preserves tracked prompt text during refresh', async () => {
            provider.resolveWebviewView(mockView as unknown as vscode.WebviewView, {} as unknown as vscode.WebviewViewResolveContext, {} as unknown as vscode.CancellationToken);
            provider.saveText('prePrompt', 'Draft intro');
            provider.saveText('instruction', 'Draft instruction');
            provider.saveText('postPrompt', 'Draft outro');

            await provider.sendInitialState();

            expect(mockView.webview!.postMessage).toHaveBeenCalledWith(expect.objectContaining({
                type: 'initState',
                payload: expect.objectContaining({
                    prePrompt: 'Draft intro',
                    instruction: 'Draft instruction',
                    postPrompt: 'Draft outro'
                })
            }));
        });

        it('assembles full AppState from workspaceState', async () => {
            provider.resolveWebviewView(mockView as unknown as vscode.WebviewView, {} as unknown as vscode.WebviewViewResolveContext, {} as unknown as vscode.CancellationToken);
            const recalculateSpy = vi.spyOn(GetTokensHandler.prototype, 'recalculateFileTokens').mockResolvedValue(undefined);
            
            // Setup files so getSavedSelectionClean passes
            (vscode.workspace as unknown as { setMockFile: (p: string, c: string) => void }).setMockFile('/fake/src/main.ts', 'content');

            vi.mocked(mockContext.workspaceState.get).mockImplementation((key: string) => {
                if (key === 'llm-babysitter.selected-files') { return ['src/main.ts']; }
                if (key === 'llm-babysitter.last-prePrompt-id') { return 'p1'; }
                return undefined;
            });
            
            await provider.sendInitialState();
            
            expect(mockView.webview!.postMessage).toHaveBeenCalledWith(expect.objectContaining({
                type: 'initState',
                payload: expect.objectContaining({
                    selectedFiles: ['src/main.ts'],
                    lastPrePromptId: 'p1'
                })
            }));

            expect(recalculateSpy).toHaveBeenCalledWith(['src/main.ts']);
            expect(recalculateSpy.mock.invocationCallOrder[0]).toBeLessThan(mockView.webview!.postMessage.mock.invocationCallOrder[0]);
        });

        it('handles missing or invalid state gracefully', async () => {
            provider.resolveWebviewView(mockView as unknown as vscode.WebviewView, {} as unknown as vscode.WebviewViewResolveContext, {} as unknown as vscode.CancellationToken);
            vi.mocked(mockContext.workspaceState.get).mockReturnValue(undefined);
            
            await provider.sendInitialState();
            
            const payload = vi.mocked(mockView.webview!.postMessage).mock.calls[0][0].payload;
            expect(payload.selectedFiles).toEqual([]);
            expect(payload.lastPrePromptId).toBe(null);
        });
    });

    describe('State Persistence', () => {
        it('persists preset IDs', () => {
            provider.savePresetId('prePrompt', 'abc');
            expect(mockContext.workspaceState.update).toHaveBeenCalledWith('llm-babysitter.last-prePrompt-id', 'abc');
        });

        it('persists selected files', () => {
            provider.saveSelection(['a.ts']);
            expect(mockContext.workspaceState.update).toHaveBeenCalledWith('llm-babysitter.selected-files', ['a.ts']);
        });
    });

    describe('UI Actions (postMessage wrappers)', () => {
        beforeEach(() => {
            provider.resolveWebviewView(mockView as unknown as vscode.WebviewView, {} as unknown as vscode.WebviewViewResolveContext, {} as unknown as vscode.CancellationToken);
        });

        it('sendStatus posts statusUpdate', () => {
            provider.sendStatus('success', 'msg');
            expect(mockView.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ 
                type: 'statusUpdate', 
                payload: { status: 'success', message: 'msg' } 
            }));
        });

        it('expandAll posts expandAll', () => {
            provider.expandAll();
            expect(mockView.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'expandAll' }));
        });

        it('collapseAll posts collapseAll', () => {
            provider.collapseAll();
            expect(mockView.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'collapseAll' }));
        });

        it('refresh calls sendInitialState', async () => {
            const spy = vi.spyOn(provider, 'sendInitialState');
            await provider.refresh();
            expect(spy).toHaveBeenCalled();
        });
    });
});
