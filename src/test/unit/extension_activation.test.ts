import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { activate, deactivate } from '../../extension.js';
import { LLMBabysitterViewProvider } from '../../webview/LLMBabysitterViewProvider.js';

vi.mock('../../webview/LLMBabysitterViewProvider.js', () => {
    const MockProvider = vi.fn().mockImplementation(function() {
        return {
            refresh: vi.fn(),
            expandAll: vi.fn(),
            collapseAll: vi.fn()
        };
    });
    (MockProvider as unknown as { viewType: string }).viewType = 'llm-babysitter-view';
    return { LLMBabysitterViewProvider: MockProvider };
});

describe('Extension Activation Unit Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should register commands and provider on activation', () => {
        const mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/mock/path' }
        } as unknown as vscode.ExtensionContext;

        activate(mockContext);

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('llm-babysitter.refresh', expect.any(Function));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('llm-babysitter.expandAll', expect.any(Function));
        
        expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
            'llm-babysitter-view', 
            expect.anything()
        );
    });

    it('should execute provider methods when commands are triggered', () => {
        const mockContext = { subscriptions: [], extensionUri: { fsPath: '/mock/path' } } as unknown as vscode.ExtensionContext;
        activate(mockContext);

        const registerCommand = vi.mocked(vscode.commands.registerCommand);
        const providerInstance = vi.mocked(LLMBabysitterViewProvider).mock.results[0].value;

        // Trigger refresh
        const refreshCb = registerCommand.mock.calls.find(c => c[0] === 'llm-babysitter.refresh')![1];
        refreshCb();
        expect(providerInstance.refresh).toHaveBeenCalled();

        // Trigger expandAll
        const expandCb = registerCommand.mock.calls.find(c => c[0] === 'llm-babysitter.expandAll')![1];
        expandCb();
        expect(providerInstance.expandAll).toHaveBeenCalled();

        // Trigger collapseAll
        const collapseCb = registerCommand.mock.calls.find(c => c[0] === 'llm-babysitter.collapseAll')![1];
        collapseCb();
        expect(providerInstance.collapseAll).toHaveBeenCalled();
    });

    it('should refresh when configuration changes', () => {
        const mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/mock/path' }
        } as unknown as vscode.ExtensionContext;

        activate(mockContext);
        const providerInstance = vi.mocked(LLMBabysitterViewProvider).mock.results[0].value;
        
        const onDidChangeConfiguration = vi.mocked(vscode.workspace.onDidChangeConfiguration);
        const callback = onDidChangeConfiguration.mock.calls[0][0];
        const mockEvent = { affectsConfiguration: vi.fn().mockReturnValue(true) };
        
        callback(mockEvent as unknown as vscode.ConfigurationChangeEvent);
        expect(providerInstance.refresh).toHaveBeenCalled();
    });

    it('should have a no-op deactivate function', () => {
        expect(() => deactivate()).not.toThrow();
    });
});
