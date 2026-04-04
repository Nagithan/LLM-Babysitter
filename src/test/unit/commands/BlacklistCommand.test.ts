import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { BlacklistCommand } from '../../../commands/BlacklistCommand.js';
import { TestUtils } from '../../testUtils.js';

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
    let mockProvider: any;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockProvider = {
            refresh: vi.fn()
        };
        vi.clearAllMocks();
    });

    it('should register the command', () => {
        const mockContext: any = { subscriptions: [] };
        BlacklistCommand.register(mockContext, mockProvider);
        expect(mockContext.subscriptions.length).toBe(1);
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('llm-babysitter.blacklist', expect.any(Function));
    });

    it('should show warning if URI is not in a workspace folder', async () => {
        const uri = vscode.Uri.file('/outside/file.ts');
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(undefined);

        // Access private execute for unit testing
        await (BlacklistCommand as any).execute(uri, mockProvider);

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('active workspace folder'));
        expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should add a file pattern to excludePatterns', async () => {
        const uri = vscode.Uri.file('/workspace/src/file.ts');
        const mockFolder = { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 };
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(mockFolder as any);
        vi.spyOn(vscode.workspace, 'asRelativePath').mockReturnValue('src/file.ts');
        
        // Mock fs.stat for a file
        vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.File } as any);

        const mockConfig = {
            get: vi.fn().mockReturnValue([]),
            update: vi.fn().mockResolvedValue(undefined)
        };
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

        await (BlacklistCommand as any).execute(uri, mockProvider);

        expect(mockConfig.update).toHaveBeenCalledWith('excludePatterns', ['**/src/file.ts'], vscode.ConfigurationTarget.Workspace);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('Added to LLM Babysitter blacklist: src/file.ts'));
        expect(mockProvider.refresh).toHaveBeenCalled();
    });

    it('should add a directory pattern to excludePatterns', async () => {
        const uri = vscode.Uri.file('/workspace/src');
        const mockFolder = { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 };
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(mockFolder as any);
        vi.spyOn(vscode.workspace, 'asRelativePath').mockReturnValue('src');
        
        vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.Directory } as any);

        const mockConfig = {
            get: vi.fn().mockReturnValue(['existing/pattern']),
            update: vi.fn().mockResolvedValue(undefined)
        };
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

        await (BlacklistCommand as any).execute(uri, mockProvider);

        expect(mockConfig.update).toHaveBeenCalledWith(
            'excludePatterns', 
            ['existing/pattern', '**/src/**'], 
            vscode.ConfigurationTarget.Workspace
        );
    });

    it('should not add pattern if it already exists', async () => {
        const uri = vscode.Uri.file('/workspace/file.ts');
        const mockFolder = { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 };
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(mockFolder as any);
        vi.spyOn(vscode.workspace, 'asRelativePath').mockReturnValue('file.ts');
        vi.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.File } as any);

        const mockConfig = {
            get: vi.fn().mockReturnValue(['**/file.ts']),
            update: vi.fn().mockResolvedValue(undefined)
        };
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig as any);

        await (BlacklistCommand as any).execute(uri, mockProvider);

        expect(mockConfig.update).not.toHaveBeenCalled();
        expect(mockProvider.refresh).not.toHaveBeenCalled();
    });

    it('should handle fs.stat errors gracefully', async () => {
        const uri = vscode.Uri.file('/workspace/file.ts');
        const mockFolder = { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 };
        vi.spyOn(vscode.workspace, 'getWorkspaceFolder').mockReturnValue(mockFolder as any);
        
        vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('FS Error'));

        await (BlacklistCommand as any).execute(uri, mockProvider);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Could not access file system'));
        expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should return early if no URI is provided', async () => {
        await (BlacklistCommand as any).execute(undefined, mockProvider);
        expect(vscode.workspace.getWorkspaceFolder).not.toHaveBeenCalled();
    });
});
