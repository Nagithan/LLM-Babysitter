import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { activate, deactivate } from '../../extension.js';

describe('Extension Activation Unit Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should register commands and provider on activation', () => {
        const mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/mock/path' }
        } as any;

        activate(mockContext);

        // Verify subscriptions length (commands + provider + configuration change)
        // 1 provider + 1 blacklist + 3 other commands + 1 listener = 6+
        expect(mockContext.subscriptions.length).toBeGreaterThan(5);

        // Verify some specific commands
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('backseat-pilot.refresh', expect.any(Function));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('backseat-pilot.expandAll', expect.any(Function));
        
        // Verify webview provider registration
        expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
            'backseat-pilot-view', 
            expect.anything()
        );
    });

    it('should refresh when configuration changes', () => {
        const mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/mock/path' }
        } as any;

        activate(mockContext);
        
        // Find the configuration change listener
        const onDidChangeConfiguration = vi.mocked(vscode.workspace.onDidChangeConfiguration);
        expect(onDidChangeConfiguration).toHaveBeenCalled();
        
        const callback = onDidChangeConfiguration.mock.calls[0][0];
        const mockEvent = {
            affectsConfiguration: vi.fn().mockReturnValue(true)
        };
        
        callback(mockEvent as any);
        expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith('backseat-pilot');
    });

    it('should have a no-op deactivate function', () => {
        expect(() => deactivate()).not.toThrow();
    });
});
