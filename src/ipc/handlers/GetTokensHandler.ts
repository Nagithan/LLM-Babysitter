import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';
import { PromptGenerator } from '../../core/PromptGenerator.js';
import { FileManager } from '../../core/FileManager.js';

/**
 * Real-time token estimation handler.
 * Aggregates lengths across sections and recursively selected files.
 */
export class GetTokensHandler implements IIpcMessageHandler {
    constructor(private webview: IWebviewAccess) {}

    async execute(message: WebviewMessage) {
        if (message.type === IpcMessageId.GET_TOKENS) {
            const { text, selectedFiles } = message.payload;
            
            const promptTokens = PromptGenerator.estimateTokens(text);
            let fileTokens = 0;
            
            if (selectedFiles && selectedFiles.length > 0) {
                for (const filePath of selectedFiles) {
                    try {
                        const content = await FileManager.getFileContent(filePath);
                        fileTokens += PromptGenerator.estimateTokens(content);
                    } catch {
                        // Skip unreadable files (e.g. removed since selection)
                        continue;
                    }
                }
            }
            
            this.webview.postMessage({ 
                type: 'tokenUpdate', 
                payload: {
                    total: promptTokens + fileTokens,
                    prompts: promptTokens,
                    files: fileTokens
                }
            });
        }
    }
}
