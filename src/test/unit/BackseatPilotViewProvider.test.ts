import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { BackseatPilotViewProvider } from '../../webview/BackseatPilotViewProvider.js';
import { FileManager } from '../../core/FileManager.js';
import { PresetManager } from '../../core/PresetManager.js';
import { LocaleManager } from '../../i18n/LocaleManager.js';
import { WebviewHtmlFactory } from '../../webview/WebviewHtmlFactory.js';
import { IpcMessageRouter } from '../../ipc/IpcMessageRouter.js';
import { Logger } from '../../core/Logger.js';
import { IpcMessageId, Preset } from '../../types/index.js';

describe('BackseatPilotViewProvider', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: any;
    let mockView: any;
    let provider: BackseatPilotViewProvider;
    let mockLogger: any;
    let mockRouter: any;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Mock Internal Dependencies Prototype or Static methods
        sandbox.stub(FileManager, 'getRoots').resolves([]);
        sandbox.stub(PresetManager.prototype, 'getPresets').returns([]);
        sandbox.stub(LocaleManager, 'getTranslations').returns({});
        sandbox.stub(LocaleManager, 'getTranslation').returns('mocked-translation');
        sandbox.stub(WebviewHtmlFactory, 'getHtml').returns('<html></html>');
        
        // Router and Logger
        mockRouter = {
            register: sandbox.stub(),
            handleMessage: sandbox.stub().resolves()
        };
        sandbox.stub(IpcMessageRouter.prototype, 'register').callsFake(mockRouter.register);
        sandbox.stub(IpcMessageRouter.prototype, 'handleMessage').callsFake(mockRouter.handleMessage);
        
        mockLogger = {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub()
        };
        sandbox.stub(Logger, 'getInstance').returns(mockLogger as any);

        mockContext = {
            subscriptions: [],
            extensionUri: vscode.Uri.parse('file:///fake'),
            globalStorageUri: vscode.Uri.parse('file:///fake-storage'),
            workspaceState: {
                get: sandbox.stub().returns(undefined),
                update: sandbox.stub().resolves()
            },
            globalState: {
                get: sandbox.stub().returns(undefined),
                update: sandbox.stub().resolves()
            }
        };

        mockView = {
            webview: {
                options: {},
                html: '',
                postMessage: sandbox.stub().resolves(),
                onDidReceiveMessage: sandbox.stub().returns({ dispose: sandbox.stub() }),
                cspSource: 'vscode-resource:'
            },
            onDidDispose: sandbox.stub().returns({ dispose: sandbox.stub() })
        };

        provider = new BackseatPilotViewProvider(
            mockContext.extensionUri,
            mockContext
        );
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('constructor', () => {
        it('registers exactly 11 IPC handlers in initializeHandlers', () => {
            // 11 handlers are registered in initializeHandlers: 
            // READY, SAVE_PRESET, DELETE_PRESET, UPDATE_SELECTION, COPY_TO_CLIPBOARD, 
            // GET_TOKENS, EXPAND_FOLDER, COPY_TO_CLIPBOARD_RAW, MANAGE_PRESET, 
            // SET_SELECTED_PRESET, UPDATE_TEXT
            assert.strictEqual(mockRouter.register.callCount, 11, 'Should register 11 handlers');
            assert.strictEqual(mockRouter.register.firstCall.args[0], IpcMessageId.READY, 'First handler should be READY');
        });
    });

    describe('resolveWebviewView', () => {
        const cancellationToken: any = { isCancellationRequested: false, onCancellationRequested: sinon.stub() };

        it('sets webview options with enableScripts true and correct localResourceRoots', () => {
            provider.resolveWebviewView(mockView, {} as any, cancellationToken);
            assert.strictEqual(mockView.webview.options.enableScripts, true, 'enableScripts should be true');
            assert.strictEqual(mockView.webview.options.localResourceRoots.length, 2, 'Should have 2 local resource roots');
        });

        it('injects HTML from WebviewHtmlFactory into webview.html', () => {
            provider.resolveWebviewView(mockView, {} as any, cancellationToken);
            assert.strictEqual(mockView.webview.html, '<html></html>', 'HTML should be injected from factory');
        });

        it('registers onDidDispose listener that clears _view reference', () => {
            provider.resolveWebviewView(mockView, {} as any, cancellationToken);
            const disposeCallback = mockView.onDidDispose.firstCall.args[0];
            
            // Trigger dispose
            disposeCallback();
            
            // Verify reference is cleared by ensuring postMessage doesn't call webview.postMessage
            provider.postMessage({ type: 'test' } as any);
            assert.strictEqual(mockView.webview.postMessage.called, false, 'postMessage should not be called after disposal');
        });

        it('registers onDidReceiveMessage and delegates to ipcRouter.handleMessage', async () => {
            provider.resolveWebviewView(mockView, {} as any, cancellationToken);
            const messageHandler = mockView.webview.onDidReceiveMessage.firstCall.args[0];
            
            const message = { type: IpcMessageId.READY };
            await messageHandler(message);
            
            assert.ok(mockRouter.handleMessage.calledOnceWith(message), 'Should delegate message to router');
        });

        it('calls sendStatus with error when ipcRouter.handleMessage throws', async () => {
            provider.resolveWebviewView(mockView, {} as any, cancellationToken);
            const messageHandler = mockView.webview.onDidReceiveMessage.firstCall.args[0];
            
            const error = new Error('boom');
            mockRouter.handleMessage.rejects(error);
            
            await messageHandler({ type: 'ready' } as any);
            
            assert.ok(mockLogger.error.calledOnce, 'Should log error');
            assert.ok(mockLogger.error.firstCall.args[0].includes('boom'), 'Log should contain error message');
            assert.ok(mockView.webview.postMessage.calledWith(sinon.match({ 
                type: 'statusUpdate', 
                payload: { status: 'error', message: 'mocked-translation' } 
            })), 'Should send error status to webview');
        });
    });

    describe('sendInitialState', () => {
        it('returns immediately without posting when _view is undefined', async () => {
            await provider.sendInitialState();
            assert.strictEqual(mockView.webview.postMessage.called, false, 'Should not post message');
        });

        it('assembles full AppState and calls webview.postMessage with type initState', async () => {
            provider.resolveWebviewView(mockView, {} as any, {} as any);
            
            mockContext.workspaceState.get.withArgs('selectedFiles').returns(['src/main.ts']);
            mockContext.workspaceState.get.withArgs('backseat-pilot.last-prePrompt-id').returns('p1');
            mockContext.workspaceState.get.withArgs('backseat-pilot.last-postPrompt-id').returns(null);
            
            await provider.sendInitialState();
            
            assert.ok(mockView.webview.postMessage.calledOnce, 'Should post initState');
            const call = mockView.webview.postMessage.firstCall;
            assert.strictEqual(call.args[0].type, 'initState');
            assert.deepStrictEqual(call.args[0].payload.selectedFiles, ['src/main.ts']);
            assert.strictEqual(call.args[0].payload.lastPrePromptId, 'p1');
            assert.strictEqual(call.args[0].payload.lastPostPromptId, null);
        });

        it('falls back selectedFiles to [] when workspaceState returns non-array', async () => {
            provider.resolveWebviewView(mockView, {} as any, {} as any);
            mockContext.workspaceState.get.withArgs('selectedFiles').returns('not-an-array');
            
            await provider.sendInitialState();
            
            assert.deepStrictEqual(mockView.webview.postMessage.firstCall.args[0].payload.selectedFiles, [], 'Should fallback to empty array');
        });

        it('passes null for lastPrePromptId when workspaceState returns undefined', async () => {
            provider.resolveWebviewView(mockView, {} as any, {} as any);
            mockContext.workspaceState.get.returns(undefined);
            
            await provider.sendInitialState();
            
            const payload = mockView.webview.postMessage.firstCall.args[0].payload;
            assert.strictEqual(payload.lastPrePromptId, null, 'Should be null if undefined');
            assert.strictEqual(payload.lastPostPromptId, null, 'Should be null if undefined');
        });
    });

    describe('savePresetId', () => {
        it('persists prePrompt id to workspaceState with correct key', () => {
            provider.savePresetId('prePrompt', 'abc-123');
            assert.ok(mockContext.workspaceState.update.calledWith('backseat-pilot.last-prePrompt-id', 'abc-123'));
        });

        it('persists postPrompt id to workspaceState with correct key', () => {
            provider.savePresetId('postPrompt', 'xyz-456');
            assert.ok(mockContext.workspaceState.update.calledWith('backseat-pilot.last-postPrompt-id', 'xyz-456'));
        });

        it('persists null to clear a preset id', () => {
            provider.savePresetId('prePrompt', null);
            assert.ok(mockContext.workspaceState.update.calledWith('backseat-pilot.last-prePrompt-id', null));
        });
    });

    describe('saveSelection', () => {
        it('persists selection array to workspaceState', () => {
            provider.saveSelection(['a.ts', 'b.ts']);
            assert.ok(mockContext.workspaceState.update.calledWith('selectedFiles', ['a.ts', 'b.ts']));
        });

        it('persists empty array', () => {
            provider.saveSelection([]);
            assert.ok(mockContext.workspaceState.update.calledWith('selectedFiles', []));
        });
    });

    describe('postMessage', () => {
        it('calls webview.postMessage when _view is defined', () => {
            provider.resolveWebviewView(mockView, {} as any, {} as any);
            const msg: any = { type: 'expandAll' };
            provider.postMessage(msg);
            assert.ok(mockView.webview.postMessage.calledWith(msg));
        });

        it('does NOT throw when _view is undefined', () => {
            assert.doesNotThrow(() => provider.postMessage({ type: 'test' } as any));
        });
    });

    describe('sendStatus', () => {
        it('dispatches statusUpdate message with success status', () => {
            provider.resolveWebviewView(mockView, {} as any, {} as any);
            provider.sendStatus('success', 'All good');
            assert.ok(mockView.webview.postMessage.calledWith(sinon.match({ 
                type: 'statusUpdate', 
                payload: { status: 'success', message: 'All good' } 
            })));
        });

        it('dispatches statusUpdate message with error status', () => {
            provider.resolveWebviewView(mockView, {} as any, {} as any);
            provider.sendStatus('error', 'Something broke');
            assert.ok(mockView.webview.postMessage.calledWith(sinon.match({ 
                type: 'statusUpdate', 
                payload: { status: 'error', message: 'Something broke' } 
            })));
        });
    });

    describe('expandAll', () => {
        it('dispatches expandAll message type to webview', () => {
            provider.resolveWebviewView(mockView, {} as any, {} as any);
            provider.expandAll();
            assert.ok(mockView.webview.postMessage.calledWith(sinon.match({ type: 'expandAll' })));
        });
    });

    describe('collapseAll', () => {
        it('dispatches collapseAll message type to webview', () => {
            provider.resolveWebviewView(mockView, {} as any, {} as any);
            provider.collapseAll();
            assert.ok(mockView.webview.postMessage.calledWith(sinon.match({ type: 'collapseAll' })));
        });
    });

    describe('refresh', () => {
        it('delegates to sendInitialState', async () => {
            provider.resolveWebviewView(mockView, {} as any, {} as any);
            const spy = sandbox.spy(provider, 'sendInitialState');
            await provider.refresh();
            assert.ok(spy.calledOnce, 'refresh should call sendInitialState');
        });
    });
});
