import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadyHandler } from '../../../../ipc/handlers/ReadyHandler.js';
import { TestUtils } from '../../../testUtils.js';

describe('ReadyHandler Unit Tests', () => {
    let mockWebview: any;
    let handler: ReadyHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            sendInitialState: vi.fn().mockResolvedValue(undefined)
        };
        handler = new ReadyHandler(mockWebview);
    });

    it('should call sendInitialState on execute', async () => {
        await handler.execute();
        expect(mockWebview.sendInitialState).toHaveBeenCalled();
    });
});
