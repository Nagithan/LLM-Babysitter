import { describe, it, expect } from 'vitest';
import { UpdateTextHandler } from '../../../../ipc/handlers/UpdateTextHandler.js';
import { WebviewMessage } from '../../../../types/index.js';

describe('UpdateTextHandler Unit Tests', () => {
    const handler = new UpdateTextHandler();

    it('should exist and satisfy the interface (no-op)', () => {
        // This handler is a no-op by design in the current stateless architecture.
        // We test it exists and doesn't crash on execution.
        expect(() => {
            handler.execute({} as WebviewMessage);
        }).not.toThrow();
    });
});
