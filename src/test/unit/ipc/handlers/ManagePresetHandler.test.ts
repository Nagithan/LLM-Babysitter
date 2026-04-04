import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { ManagePresetHandler } from '../../../../ipc/handlers/ManagePresetHandler.js';
import { IpcMessageId } from '../../../../types/index.js';
import { Logger } from '../../../../core/Logger.js';
import { TestUtils } from '../../../testUtils.js';

describe('ManagePresetHandler Unit Tests', () => {
    let mockWebview: any;
    let mockPresetManager: any;
    let handler: ManagePresetHandler;
    let mockLogger: any;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            postMessage: vi.fn(),
            sendStatus: vi.fn(),
            sendInitialState: vi.fn().mockResolvedValue(undefined)
        };
        mockPresetManager = {
            getPresets: vi.fn(),
            savePreset: vi.fn().mockResolvedValue(undefined),
            deletePreset: vi.fn().mockResolvedValue(undefined)
        };
        mockLogger = {
            error: vi.fn()
        };
        vi.spyOn(Logger, 'getInstance').mockReturnValue(mockLogger as any);
        
        handler = new ManagePresetHandler(mockWebview, mockPresetManager as any);
    });

    it('should ignore non-existent presets', async () => {
        mockPresetManager.getPresets.mockReturnValue([]);
        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'unknown', type: 'prePrompt', currentText: '' }
        });
        expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should prevent modification of built-in presets', async () => {
        mockPresetManager.getPresets.mockReturnValue([
            { id: 'built-in-1', name: 'Built-in', content: '...', type: 'prePrompt' }
        ]);
        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'built-in-1', type: 'prePrompt', currentText: '' }
        });
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('error', expect.stringContaining('Built-in templates cannot be modified'));
    });

    it('should handle renaming a preset', async () => {
        const preset = { id: 'p1', name: 'Old Name', content: 'Content', type: 'prePrompt' };
        mockPresetManager.getPresets.mockReturnValue([preset]);
        
        vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ value: 'rename' } as any);
        vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('New Name');

        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'p1', type: 'prePrompt', currentText: '' }
        });

        expect(mockPresetManager.savePreset).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should handle updating a preset with current text', async () => {
        const preset = { id: 'p1', name: 'Preset 1', content: 'Old content', type: 'prePrompt' };
        mockPresetManager.getPresets.mockReturnValue([preset]);
        
        vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ value: 'update' } as any);

        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'p1', type: 'prePrompt', currentText: 'New Content' }
        });

        expect(mockPresetManager.savePreset).toHaveBeenCalledWith(expect.objectContaining({ content: 'New Content' }));
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('success', expect.stringContaining('updated successfully'));
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should handle deleting a preset with confirmation', async () => {
        const preset = { id: 'p1', name: 'To Delete', content: 'Content', type: 'prePrompt' };
        mockPresetManager.getPresets.mockReturnValue([preset]);
        
        vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ value: 'delete' } as any);
        vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Delete' as any);

        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'p1', type: 'prePrompt', currentText: '' }
        });

        expect(mockPresetManager.deletePreset).toHaveBeenCalledWith('p1');
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should skip deletion if not confirmed', async () => {
        const preset = { id: 'p1', name: 'Keep Me', content: 'Content', type: 'prePrompt' };
        mockPresetManager.getPresets.mockReturnValue([preset]);
        
        vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ value: 'delete' } as any);
        vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);

        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'p1', type: 'prePrompt', currentText: '' }
        });

        expect(mockPresetManager.deletePreset).not.toHaveBeenCalled();
    });

    it('should show error when trying to update with empty/whitespace content', async () => {
        const preset = { id: 'p1', name: 'Preset 1', content: 'Old content', type: 'prePrompt' };
        mockPresetManager.getPresets.mockReturnValue([preset]);
        
        vi.spyOn(vscode.window, 'showQuickPick').mockResolvedValue({ value: 'update' } as any);

        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'p1', type: 'prePrompt', currentText: '   ' }
        });

        expect(mockWebview.sendStatus).toHaveBeenCalledWith('error', expect.stringContaining('empty content'));
        expect(mockPresetManager.savePreset).not.toHaveBeenCalled();
    });
});
