import { WebviewMessage } from '../../types/index.js';

/**
 * Strategy/Command Pattern Interface for IPC Message Handlers.
 * Responsibility: Atomize business logic associated with specific IPC signals.
 */
export interface IIpcMessageHandler {
    /**
     * Executes the logic for a specific IPC message.
     * @param message The raw message received from the webview.
     */
    execute(message: WebviewMessage): Promise<void> | void;
}
