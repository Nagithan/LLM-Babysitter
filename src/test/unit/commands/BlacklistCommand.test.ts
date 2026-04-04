import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import { BlacklistCommand } from '../../../commands/BlacklistCommand.js';
import { TestUtils } from '../../testUtils.js';
import { LLMBabysitterViewProvider } from '../../../webview/LLMBabysitterViewProvider.js';

// Mock the Logger entirely to handle the static initialization in BlacklistCommand
const { mockLogger } = vi.hoisted(() => ({
    mockLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));

vi.mock('../../../core/Logger.js', () => ({
    Logger: {
        getInstance: () => mockLogger
    }
}));

describe('BlacklistCommand Unit Tests', () => {
    let mockProvider: { refresh: Mock };

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockProvider = {
            refresh: vi.fn()
        };
        vi.clearAllMocks();
    });

    it('should register the command', () => {
        const mockContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        BlacklistCommand.register(mockContext, mockProvider as unknown as LLMBabysitterViewProvider);
        expect(mockContext.subscriptions.length).toBe(1);
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('llm-babysitter.blacklist', expect.any(Function));
    });

    it('should show warning if URI is not in a workspace folder', async () => {
        const uri = vscode.Uri.file('/outside/file.ts');
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(undefined);

        // Access private execute for unit testing
        await (BlacklistCommand as unknown as { execute: (uri: vscode.Uri | undefined, provider: LLMBabysitterViewProvider) => Promise<void> }).execute(uri, mockProvider as unknown as LLMBabysitterViewProvider);

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('active workspace folder'));
        expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should add a file pattern to excludePatterns', async () => {
        const uri = vscode.Uri.file('/workspace/src/file.ts');
        const mockFolder = { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 } as vscode.WorkspaceFolder;
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(mockFolder);
        vi.spyOn(vscode.workspace, 'asRelativePath').mockReturnValue('src/file.ts');
        
        // Mock fs.stat for a file
        vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 });

        const mockConfig = {
            get: vi.fn().mockReturnValue([]),
            update: vi.fn().mockResolvedValue(undefined)
        };
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as unknown as vscode.WorkspaceConfiguration);

        await (BlacklistCommand as unknown as { execute: (uri: vscode.Uri | undefined, provider: LLMBabysitterViewProvider) => Promise<void> }).execute(uri, mockProvider as unknown as LLMBabysitterViewProvider);

        expect(mockConfig.update).toHaveBeenCalledWith('excludePatterns', ['**/src/file.ts'], vscode.ConfigurationTarget.Workspace);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('Added to LLM Babysitter blacklist: src/file.ts'));
        expect(mockProvider.refresh).toHaveBeenCalled();
    });

    it('should add a directory pattern to excludePatterns', async () => {
        const uri = vscode.Uri.file('/workspace/src');
        const mockFolder = { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 } as vscode.WorkspaceFolder;
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(mockFolder);
        vi.spyOn(vscode.workspace, 'asRelativePath').mockReturnValue('src');
        
        vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 });

        const mockConfig = {
            get: vi.fn().mockReturnValue(['existing/pattern']),
            update: vi.fn().mockResolvedValue(undefined)
        };
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as unknown as vscode.WorkspaceConfiguration);

        await (BlacklistCommand as unknown as { execute: (uri: vscode.Uri | undefined, provider: LLMBabysitterViewProvider) => Promise<void> }).execute(uri, mockProvider as unknown as LLMBabysitterViewProvider);

        expect(mockConfig.update).toHaveBeenCalledWith(
            'excludePatterns', 
            ['existing/pattern', '**/src/**'], 
            vscode.ConfigurationTarget.Workspace
        );
    });

    it('should correctly identify a symbolic link to a directory using bitwise logic', async () => {
        const uri = vscode.Uri.file('/workspace/symlink-dir');
        const mockFolder = { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 } as vscode.WorkspaceFolder;
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(mockFolder);
        vi.spyOn(vscode.workspace, 'asRelativePath').mockReturnValue('symlink-dir');
        
        // Mock fs.stat for a symbolic link to a directory (64 | 2 = 66)
        vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ 
            type: vscode.FileType.SymbolicLink | vscode.FileType.Directory,
            ctime: 0,
            mtime: 0,
            size: 0
        });

        const mockConfig = {
            get: vi.fn().mockReturnValue([]),
            update: vi.fn().mockResolvedValue(undefined)
        };
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as unknown as vscode.WorkspaceConfiguration);

        await (BlacklistCommand as unknown as { execute: (uri: vscode.Uri | undefined, provider: LLMBabysitterViewProvider) => Promise<void> }).execute(uri, mockProvider as unknown as LLMBabysitterViewProvider);

        // Pattern should be directory-style: **/path/**
        expect(mockConfig.update).toHaveBeenCalledWith(
            'excludePatterns', 
            ['**/symlink-dir/**'], 
            vscode.ConfigurationTarget.Workspace
        );
    });

    it('should not add pattern if it already exists', async () => {
        const uri = vscode.Uri.file('/workspace/file.ts');
        const mockFolder = { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 } as vscode.WorkspaceFolder;
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(mockFolder);
        vi.spyOn(vscode.workspace, 'asRelativePath').mockReturnValue('file.ts');
        vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 });

        const mockConfig = {
            get: vi.fn().mockReturnValue(['**/file.ts']),
            update: vi.fn().mockResolvedValue(undefined)
        };
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as unknown as vscode.WorkspaceConfiguration);

        await (BlacklistCommand as unknown as { execute: (uri: vscode.Uri | undefined, provider: LLMBabysitterViewProvider) => Promise<void> }).execute(uri, mockProvider as unknown as LLMBabysitterViewProvider);

        expect(mockConfig.update).not.toHaveBeenCalled();
        expect(mockProvider.refresh).not.toHaveBeenCalled();
    });

    it('should handle fs.stat errors gracefully', async () => {
        const uri = vscode.Uri.file('/workspace/file.ts');
        const mockFolder = { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 } as vscode.WorkspaceFolder;
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(mockFolder);
        
        vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('FS Error'));

        await (BlacklistCommand as unknown as { execute: (uri: vscode.Uri | undefined, provider: LLMBabysitterViewProvider) => Promise<void> }).execute(uri, mockProvider as unknown as LLMBabysitterViewProvider);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Could not access file system'));
        expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should return early if no URI is provided', async () => {
        await (BlacklistCommand as unknown as { execute: (uri: vscode.Uri | undefined, provider: LLMBabysitterViewProvider) => Promise<void> }).execute(undefined, mockProvider as unknown as LLMBabysitterViewProvider);
        expect(vscode.workspace.getWorkspaceFolder).not.toHaveBeenCalled();
    });

    it('should execute the registered command callback', async () => {
        const mockContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        BlacklistCommand.register(mockContext, mockProvider as unknown as LLMBabysitterViewProvider);
        
        const registerCommand = vi.mocked(vscode.commands.registerCommand);
        const callback = registerCommand.mock.calls.find(c => c[0] === 'llm-babysitter.blacklist')![1];
        
        // Mock execute to verify it's called
        const executeSpy = vi.spyOn(BlacklistCommand as unknown as { execute: (uri: vscode.Uri | undefined, provider: LLMBabysitterViewProvider) => Promise<void> }, 'execute').mockResolvedValue(undefined);
        
        const uri = vscode.Uri.file('/test/path');
        await callback(uri);
        
        expect(executeSpy).toHaveBeenCalledWith(uri, mockProvider);
    });
});
