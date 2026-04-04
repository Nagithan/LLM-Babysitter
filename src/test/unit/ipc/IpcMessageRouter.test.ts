import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpcMessageRouter } from '../../../ipc/IpcMessageRouter.js';
import { IpcMessageId, WebviewMessage } from '../../../types/index.js';
import { Logger } from '../../../core/Logger.js';

describe('IpcMessageRouter Unit Tests', () => {
    let router: IpcMessageRouter;
    let mockLogger: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.clearAllMocks();
        mockLogger = {
            error: vi.fn(),
            info: vi.fn()
        };
        vi.spyOn(Logger, 'getInstance').mockReturnValue(mockLogger as unknown as Logger);
        router = new IpcMessageRouter();
    });

    it('should register handlers and dispatch messages correctly', async () => {
        const mockHandler = {
            execute: vi.fn().mockResolvedValue(undefined)
        };

        router.register(IpcMessageId.READY, mockHandler);

        const message: WebviewMessage = {
            type: IpcMessageId.READY
        };

        await router.handleMessage(message);

        expect(mockHandler.execute).toHaveBeenCalledWith(message);
    });

    it('should throw an error when no handler is registered for a message type', async () => {
        const message: WebviewMessage = {
            type: IpcMessageId.EXPAND_FOLDER,
            payload: '/some/path'
        };

        await expect(router.handleMessage(message)).rejects.toThrow('No IPC handler registered');
    });

    it('should prevent duplicate registration of handlers for the same type (last one wins)', async () => {
        const h1 = { execute: vi.fn() };
        const h2 = { execute: vi.fn() };

        router.register(IpcMessageId.READY, h1);
        router.register(IpcMessageId.READY, h2);

        const message = { type: IpcMessageId.READY };
        await router.handleMessage(message as unknown as WebviewMessage);
        
        expect(h2.execute).toHaveBeenCalled();
        expect(h1.execute).not.toHaveBeenCalled();
    });

    it('should handle registration of different handlers for different types', async () => {
        const h1 = { execute: vi.fn() };
        const h2 = { execute: vi.fn() };

        router.register(IpcMessageId.READY, h1);
        router.register(IpcMessageId.SAVE_PRESET, h2);

        await router.handleMessage({ type: IpcMessageId.READY } as unknown as WebviewMessage);
        expect(h1.execute).toHaveBeenCalled();
        expect(h2.execute).not.toHaveBeenCalled();

        await router.handleMessage({ type: IpcMessageId.SAVE_PRESET, payload: {} } as unknown as WebviewMessage);
        expect(h2.execute).toHaveBeenCalled();
    });

    it('should throw "Handler [type] execution failed" when handler rejects', async () => {
        const failingHandler = {
            execute: vi.fn().mockRejectedValue(new Error('simulated crash'))
        };

        router.register(IpcMessageId.READY, failingHandler);

        const message: WebviewMessage = {
            type: IpcMessageId.READY
        };

        await expect(router.handleMessage(message)).rejects.toThrow('Handler [ready] execution failed: simulated crash');
    });
});
