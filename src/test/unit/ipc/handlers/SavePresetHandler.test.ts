import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SavePresetHandler } from '../../../../ipc/handlers/SavePresetHandler.js';
import { IpcMessageId } from '../../../../types/index.js';
import { Logger } from '../../../../core/Logger.js';
import { TestUtils } from '../../../testUtils.js';

describe('SavePresetHandler Unit Tests', () => {
    let mockWebview: any;
    let mockPresetManager: any;
    let handler: SavePresetHandler;
    let mockLogger: any;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            sendInitialState: vi.fn().mockResolvedValue(undefined)
        };
        mockPresetManager = {
            savePreset: vi.fn().mockResolvedValue(undefined)
        };
        mockLogger = {
            info: vi.fn()
        };
        vi.spyOn(Logger, 'getInstance').mockReturnValue(mockLogger as any);
        
        handler = new SavePresetHandler(mockWebview, mockPresetManager as any);
    });

    it('should save a preset and refresh state', async () => {
        const preset = { id: 'p1', name: 'Saved Preset', content: 'C1', type: 'prePrompt' };
        await handler.execute({
            type: IpcMessageId.SAVE_PRESET,
            payload: preset as any
        });

        expect(mockPresetManager.savePreset).toHaveBeenCalledWith(preset);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Saved Preset'));
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should ignore non-SAVE_PRESET messages', async () => {
        await (handler as any).execute({
            type: IpcMessageId.READY,
            payload: {}
        });

        expect(mockPresetManager.savePreset).not.toHaveBeenCalled();
        expect(mockWebview.sendInitialState).not.toHaveBeenCalled();
    });
});
