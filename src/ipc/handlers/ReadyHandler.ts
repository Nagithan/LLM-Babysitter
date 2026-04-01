import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';

export class ReadyHandler implements IIpcMessageHandler {
    constructor(private webview: IWebviewAccess) {}
    async execute() {
        await this.webview.sendInitialState();
    }
}
