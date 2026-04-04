import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateSelectionHandler } from '../../../../ipc/handlers/UpdateSelectionHandler.js';
import { IpcMessageId } from '../../../../types/index.js';
import { TestUtils } from '../../../testUtils.js';

describe('UpdateSelectionHandler Unit Tests', () => {
    let mockWebview: any;
    let handler: UpdateSelectionHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            saveSelection: vi.fn()
        };
        handler = new UpdateSelectionHandler(mockWebview);
    });

    it('should call saveSelection with message payload', async () => {
        const selection = ['file1.ts', 'file2.ts'];
        await handler.execute({
            type: IpcMessageId.UPDATE_SELECTION,
            payload: selection
        });

        expect(mockWebview.saveSelection).toHaveBeenCalledWith(selection);
    });

    it('should ignore non-UPDATE_SELECTION messages', async () => {
        await (handler as any).execute({
            type: IpcMessageId.READY,
            payload: {}
        });

        expect(mockWebview.saveSelection).not.toHaveBeenCalled();
    });
});
