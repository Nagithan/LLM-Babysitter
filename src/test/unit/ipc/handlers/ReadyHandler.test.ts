import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ReadyHandler } from '../../../../ipc/handlers/ReadyHandler.js';
import { IpcMessageId, WebviewMessage } from '../../../../types/index.js';
import { TestUtils } from '../../../testUtils.js';
import { IWebviewAccess } from '../../../../ipc/handlers/IWebviewAccess.js';

describe('ReadyHandler Unit Tests', () => {
    let mockWebview: Partial<IWebviewAccess> & { sendInitialState: Mock };
    let handler: ReadyHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            sendInitialState: vi.fn(),
            postMessage: vi.fn(),
            sendStatus: vi.fn(),
            saveSelection: vi.fn(),
            savePresetId: vi.fn()
        };
        handler = new ReadyHandler(mockWebview as unknown as IWebviewAccess);
    });

    it('should trigger sendInitialState', async () => {
        await handler.execute({
            type: IpcMessageId.READY,
            payload: {}
        } as unknown as WebviewMessage);

        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });

    it('should ignore non-READY messages', async () => {
        await handler.execute({
            type: IpcMessageId.UPDATE_TEXT,
            payload: {}
        } as unknown as WebviewMessage);

        expect(mockWebview.sendInitialState).not.toHaveBeenCalled();
    });
});
