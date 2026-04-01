import { WebviewMessage } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';

/**
 * Handler for reactive text updates.
 * Note: Current architecture uses the payload of 'copyToClipboard' for generation.
 * This handler exists to satisfy the Unified IPC Bridge requirement that all 
 * outgoing webview signals are accounted for.
 */
export class UpdateTextHandler implements IIpcMessageHandler {
    execute(message: WebviewMessage): void {
        // No-op: Host-side tracking not required for stateless prompt generation.
    }
}
