import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetSelectedPresetHandler } from '../../../../ipc/handlers/SetSelectedPresetHandler.js';
import { IpcMessageId, WebviewMessage } from '../../../../types/index.js';
import { LLMBabysitterViewProvider } from '../../../../webview/LLMBabysitterViewProvider.js';
import { TestUtils } from '../../../testUtils.js';

describe('SetSelectedPresetHandler Unit Tests', () => {
    let mockWebview: { savePresetId: ReturnType<typeof vi.fn> };
    let handler: SetSelectedPresetHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            savePresetId: vi.fn()
        };
        handler = new SetSelectedPresetHandler(mockWebview as unknown as LLMBabysitterViewProvider);
    });

    it('should call savePresetId with payload', async () => {
        await handler.execute({
            type: IpcMessageId.SET_SELECTED_PRESET,
            payload: { type: 'prePrompt', id: 'p1' }
        });

        expect(mockWebview.savePresetId).toHaveBeenCalledWith('prePrompt', 'p1');
    });

    it('should ignore non-SET_SELECTED_PRESET messages', async () => {
        await (handler as unknown as { execute: (msg: WebviewMessage) => Promise<void> }).execute({
            type: IpcMessageId.READY,
            payload: {}
        } as unknown as WebviewMessage);

        expect(mockWebview.savePresetId).not.toHaveBeenCalled();
    });
});
