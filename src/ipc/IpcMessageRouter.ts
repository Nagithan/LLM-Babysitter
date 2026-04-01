import { IpcMessageId, WebviewMessage } from '../types/index.js';
import { IIpcMessageHandler } from './handlers/IpcHandler.js';

/**
 * Strategy/Command Registry for IPC Messages.
 * Decouples the message reception from the business logic.
 * Adheres to the Open/Closed Principle (OCP).
 */
export class IpcMessageRouter {
    private handlers: Map<IpcMessageId, IIpcMessageHandler> = new Map();

    /**
     * Registers a handler for a specific message type.
     * @param id The IPC message ID.
     * @param handler The specific handler implementation.
     */
    public register(id: IpcMessageId, handler: IIpcMessageHandler): void {
        this.handlers.set(id, handler);
    }

    /**
     * Routes the message to the appropriate handler.
     * @param message The raw webview message.
     */
    public async handleMessage(message: WebviewMessage): Promise<void> {
        const handler = this.handlers.get(message.type);
        if (handler) {
            try {
                await handler.execute(message);
            } catch (error: any) {
                // High-level boundary for handler failures
                throw new Error(`Handler [${message.type}] execution failed: ${error.message}`);
            }
        } else {
            // Implicit failure for unregistered messages to avoid silent drops
            throw new Error(`No IPC handler registered for message type: ${message.type}`);
        }
    }
}
