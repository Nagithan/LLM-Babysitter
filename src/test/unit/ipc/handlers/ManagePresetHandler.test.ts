import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import { ManagePresetHandler } from '../../../../ipc/handlers/ManagePresetHandler.js';
import { IpcMessageId, WebviewMessage } from '../../../../types/index.js';
import { TestUtils } from '../../../testUtils.js';
import { IWebviewAccess } from '../../../../ipc/handlers/IWebviewAccess.js';
import { PresetManager } from '../../../../core/PresetManager.js';

describe('ManagePresetHandler Unit Tests', () => {
    let mockWebview: Partial<IWebviewAccess> & { sendStatus: Mock; postMessage: Mock; sendInitialState: Mock };
    let mockPresetManager: { getPresets: Mock; savePreset: Mock; deletePreset: Mock };
    let handler: ManagePresetHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            sendStatus: vi.fn(),
            postMessage: vi.fn(),
            sendInitialState: vi.fn(),
            saveSelection: vi.fn(),
            savePresetId: vi.fn(),
            saveText: vi.fn()
        };
        mockPresetManager = {
            getPresets: vi.fn().mockReturnValue([
                { id: 'p1', name: 'Original Name', content: 'Old Content', type: 'prePrompt' },
                { id: 'built-in-1', name: 'Built-in', content: 'Fixed', type: 'prePrompt' }
            ]),
            savePreset: vi.fn().mockResolvedValue(undefined),
            deletePreset: vi.fn().mockResolvedValue(undefined)
        };
        handler = new ManagePresetHandler(
            mockWebview as unknown as IWebviewAccess,
            mockPresetManager as unknown as PresetManager
        );
    });

    it('should rename a favorite via quickpick and inputbox', async () => {
        vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ value: 'rename' } as unknown as vscode.QuickPickItem);
        vi.mocked(vscode.window.showInputBox).mockResolvedValue('New Name');

        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'p1', currentText: 'Ignored for rename' }
        } as unknown as WebviewMessage);

        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ label: expect.stringContaining('Rename') })
        ]), expect.objectContaining({ placeHolder: expect.stringContaining('Manage favorite') }));
        expect(vscode.window.showInputBox).toHaveBeenCalledWith(expect.objectContaining({ value: 'Original Name', prompt: expect.any(String) }));
        expect(mockPresetManager.savePreset).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('success', expect.any(String));
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should update a favorite content', async () => {
        vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ value: 'update' } as unknown as vscode.QuickPickItem);

        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'p1', currentText: 'Updated Content' }
        } as unknown as WebviewMessage);

        expect(mockPresetManager.savePreset).toHaveBeenCalledWith(expect.objectContaining({ 
            id: 'p1', 
            content: 'Updated Content' 
        }));
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('success', expect.any(String));
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should delete a favorite after confirmation', async () => {
        vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ value: 'delete' } as unknown as vscode.QuickPickItem);
        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Delete' as unknown as vscode.MessageItem);

        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'p1', currentText: '' }
        } as unknown as WebviewMessage);

        expect(mockPresetManager.deletePreset).toHaveBeenCalledWith('p1');
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('delete'), { modal: true }, expect.any(String));
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('success', expect.any(String));
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should show error for built-in templates', async () => {
        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'built-in-1', currentText: '' }
        } as unknown as WebviewMessage);

        expect(mockWebview.sendStatus).toHaveBeenCalledWith('error', expect.any(String));
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    });

    it('should handle cancelation at any step', async () => {
        vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

        await handler.execute({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'p1', currentText: '' }
        } as unknown as WebviewMessage);

        expect(mockPresetManager.savePreset).not.toHaveBeenCalled();
    });
});
