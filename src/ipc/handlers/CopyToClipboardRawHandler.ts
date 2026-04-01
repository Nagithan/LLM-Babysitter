import * as vscode from 'vscode';
import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';
import { LocaleManager } from '../../i18n/LocaleManager.js';

/**
 * Direct clipboard injection handler for raw content.
 */
export class CopyToClipboardRawHandler implements IIpcMessageHandler {
    constructor(private webview: IWebviewAccess) {}

    async execute(message: WebviewMessage) {
        if (message.type === IpcMessageId.COPY_TO_CLIPBOARD_RAW) {
            await vscode.env.clipboard.writeText(message.payload);
            this.webview.sendStatus('success', LocaleManager.getTranslation('status.copied'));
        }
    }
}
