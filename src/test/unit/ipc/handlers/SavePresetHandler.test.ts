import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { SavePresetHandler } from '../../../../ipc/handlers/SavePresetHandler.js';
import { IpcMessageId, WebviewMessage, Preset } from '../../../../types/index.js';
import { PresetManager } from '../../../../core/PresetManager.js';
import { TestUtils } from '../../../testUtils.js';
import { IWebviewAccess } from '../../../../ipc/handlers/IWebviewAccess.js';

describe('SavePresetHandler Unit Tests', () => {
    let mockWebview: Partial<IWebviewAccess> & { sendStatus: Mock; sendInitialState: Mock };
    let mockPresetManager: { savePreset: Mock };
    let handler: SavePresetHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            sendStatus: vi.fn(),
            postMessage: vi.fn(),
            sendInitialState: vi.fn(),
            saveSelection: vi.fn(),
            savePresetId: vi.fn()
        };
        mockPresetManager = {
            savePreset: vi.fn().mockResolvedValue(undefined)
        };
        handler = new SavePresetHandler(
            mockWebview as unknown as IWebviewAccess,
            mockPresetManager as unknown as PresetManager
        );
    });

    it('should call savePreset and send success status', async () => {
        const payload: Preset = { id: 'p1', name: 'New Preset', content: 'content', type: 'instruction' };

        await handler.execute({
            type: IpcMessageId.SAVE_PRESET,
            payload
        } as unknown as WebviewMessage);

        expect(mockPresetManager.savePreset).toHaveBeenCalledWith(payload);
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('success', expect.any(String));
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should ignore non-SAVE_PRESET messages', async () => {
        await handler.execute({
            type: IpcMessageId.READY,
            payload: {}
        } as unknown as WebviewMessage);

        expect(mockPresetManager.savePreset).not.toHaveBeenCalled();
    });
});
