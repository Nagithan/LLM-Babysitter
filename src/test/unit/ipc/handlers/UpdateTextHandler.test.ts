import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateTextHandler } from '../../../../ipc/handlers/UpdateTextHandler.js';
import { IpcMessageId } from '../../../../types/index.js';
import { TestUtils } from '../../../testUtils.js';

describe('UpdateTextHandler Unit Tests', () => {
    beforeEach(async () => {
        await TestUtils.fullReset();
    });

    it('should execute without crashing', () => {
        const handler = new UpdateTextHandler();
        expect(() => handler.execute({ type: IpcMessageId.UPDATE_TEXT, payload: 'text' } as any)).not.toThrow();
    });
});
