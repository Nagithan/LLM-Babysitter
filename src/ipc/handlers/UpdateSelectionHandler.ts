import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';

/**
 * Handler for keeping track of selected workspace files.
 */
export class UpdateSelectionHandler implements IIpcMessageHandler {
    constructor(private webview: IWebviewAccess) {}

    async execute(message: WebviewMessage) {
        if (message.type === IpcMessageId.UPDATE_SELECTION) {
            this.webview.saveSelection(message.payload);
        }
    }
}
