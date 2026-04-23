import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { DeletePresetHandler } from '../../../../ipc/handlers/DeletePresetHandler.js';
import { IpcMessageId, WebviewMessage } from '../../../../types/index.js';
import { PresetManager } from '../../../../core/PresetManager.js';
import { TestUtils } from '../../../testUtils.js';
import { IWebviewAccess } from '../../../../ipc/handlers/IWebviewAccess.js';

describe('DeletePresetHandler Unit Tests', () => {
    let mockWebview: Partial<IWebviewAccess> & { sendStatus: Mock };
    let mockPresetManager: { deletePreset: Mock };
    let handler: DeletePresetHandler;

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
            deletePreset: vi.fn().mockResolvedValue(undefined)
        };
        handler = new DeletePresetHandler(
            mockWebview as unknown as IWebviewAccess,
            mockPresetManager as unknown as PresetManager
        );
    });

    it('should call deletePreset and send success status', async () => {
        await handler.execute({
            type: IpcMessageId.DELETE_PRESET,
            payload: 'preset-id'
        } as unknown as WebviewMessage);

        expect(mockPresetManager.deletePreset).toHaveBeenCalledWith('preset-id');
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('success', expect.any(String));
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should ignore non-DELETE_PRESET messages', async () => {
        await handler.execute({
            type: IpcMessageId.READY,
            payload: {}
        } as unknown as WebviewMessage);

        expect(mockPresetManager.deletePreset).not.toHaveBeenCalled();
    });
});
