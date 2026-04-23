import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';

/**
 * Handler for reactive text updates.
 * Note: Current architecture uses the payload of 'copyToClipboard' for generation.
 * This handler exists to satisfy the Unified IPC Bridge requirement that all 
 * outgoing webview signals are accounted for.
 */
export class UpdateTextHandler implements IIpcMessageHandler {
    constructor(private webview: IWebviewAccess) {}

    execute(message: WebviewMessage): void {
        if (message.type === IpcMessageId.UPDATE_TEXT) {
            this.webview.saveText(message.payload.type, message.payload.text);
        }
    }
}
