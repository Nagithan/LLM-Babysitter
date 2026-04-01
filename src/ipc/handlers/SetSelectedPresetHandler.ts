import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';

/**
 * Persistence handler for last-used template selections.
 */
export class SetSelectedPresetHandler implements IIpcMessageHandler {
    constructor(private webview: IWebviewAccess) {}

    async execute(message: WebviewMessage) {
        if (message.type === IpcMessageId.SET_SELECTED_PRESET) {
            this.webview.savePresetId(message.payload.type, message.payload.id);
        }
    }
}
