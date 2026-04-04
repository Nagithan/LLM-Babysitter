import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetSelectedPresetHandler } from '../../../../ipc/handlers/SetSelectedPresetHandler.js';
import { IpcMessageId } from '../../../../types/index.js';
import { TestUtils } from '../../../testUtils.js';

describe('SetSelectedPresetHandler Unit Tests', () => {
    let mockWebview: any;
    let handler: SetSelectedPresetHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            savePresetId: vi.fn()
        };
        handler = new SetSelectedPresetHandler(mockWebview);
    });

    it('should call savePresetId with payload', async () => {
        await handler.execute({
            type: IpcMessageId.SET_SELECTED_PRESET,
            payload: { type: 'prePrompt', id: 'p1' }
        });

        expect(mockWebview.savePresetId).toHaveBeenCalledWith('prePrompt', 'p1');
    });

    it('should ignore non-SET_SELECTED_PRESET messages', async () => {
        await (handler as any).execute({
            type: IpcMessageId.READY,
            payload: {}
        });

        expect(mockWebview.savePresetId).not.toHaveBeenCalled();
    });
});
