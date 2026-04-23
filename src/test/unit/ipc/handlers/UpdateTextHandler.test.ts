import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateTextHandler } from '../../../../ipc/handlers/UpdateTextHandler.js';
import { WebviewMessage, IpcMessageId } from '../../../../types/index.js';
import { IWebviewAccess } from '../../../../ipc/handlers/IWebviewAccess.js';

describe('UpdateTextHandler Unit Tests', () => {
    const mockWebview = {
        saveText: vi.fn()
    } as unknown as IWebviewAccess;
    const handler = new UpdateTextHandler(mockWebview);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should persist prompt text updates for refresh-safe state', () => {
        handler.execute({
            type: IpcMessageId.UPDATE_TEXT,
            payload: { type: 'instruction', text: 'Draft prompt' }
        } as WebviewMessage);

        expect(mockWebview.saveText).toHaveBeenCalledWith('instruction', 'Draft prompt');
    });

    it('should ignore unrelated messages', () => {
        handler.execute({ type: IpcMessageId.READY } as WebviewMessage);
        expect(mockWebview.saveText).toHaveBeenCalledTimes(0);
    });
});
