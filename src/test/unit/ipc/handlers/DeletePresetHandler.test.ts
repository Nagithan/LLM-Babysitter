import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeletePresetHandler } from '../../../../ipc/handlers/DeletePresetHandler.js';
import { IpcMessageId } from '../../../../types/index.js';
import { Logger } from '../../../../core/Logger.js';
import { TestUtils } from '../../../testUtils.js';

describe('DeletePresetHandler Unit Tests', () => {
    let mockWebview: any;
    let mockPresetManager: any;
    let handler: DeletePresetHandler;
    let mockLogger: any;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            sendInitialState: vi.fn().mockResolvedValue(undefined)
        };
        mockPresetManager = {
            deletePreset: vi.fn().mockResolvedValue(undefined)
        };
        mockLogger = {
            info: vi.fn()
        };
        vi.spyOn(Logger, 'getInstance').mockReturnValue(mockLogger as any);
        
        handler = new DeletePresetHandler(mockWebview, mockPresetManager as any);
    });

    it('should delete preset and refresh state', async () => {
        await handler.execute({
            type: IpcMessageId.DELETE_PRESET,
            payload: 'p1'
        });

        expect(mockPresetManager.deletePreset).toHaveBeenCalledWith('p1');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('p1'));
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should ignore non-DELETE_PRESET messages', async () => {
        await (handler as any).execute({
            type: IpcMessageId.READY,
            payload: {}
        });

        expect(mockPresetManager.deletePreset).not.toHaveBeenCalled();
        expect(mockWebview.sendInitialState).not.toHaveBeenCalled();
    });
});
