import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';
import { PromptGenerator } from '../../core/PromptGenerator.js';
import { FileManager } from '../../core/FileManager.js';

/**
 * Real-time token estimation handler.
 * Aggregates lengths across sections and recursively selected files.
 * Caches file tokens to prevent redundant disk I/O on every keystroke.
 */
export class GetTokensHandler implements IIpcMessageHandler {
    private cachedFileTokens: number = 0;
    private recalculationPromise: Promise<void> | null = null;

    constructor(private webview: IWebviewAccess) {}

    async execute(message: WebviewMessage) {
        if (message.type === IpcMessageId.UPDATE_SELECTION) {
            const selectedFiles = message.payload;
            this.webview.saveSelection(selectedFiles);
            await this.recalculateFileTokens(selectedFiles);
        } else if (message.type === IpcMessageId.GET_TOKENS) {
            const { text } = message.payload;
            
            // If we are currently recalculating, wait for it to finish
            if (this.recalculationPromise) {
                await this.recalculationPromise;
            }
            
            const promptTokens = PromptGenerator.estimateTokens(text);
            
            this.webview.postMessage({ 
                type: 'tokenUpdate', 
                payload: {
                    total: promptTokens + this.cachedFileTokens,
                    prompts: promptTokens,
                    files: this.cachedFileTokens
                }
            });
        }
    }

    /**
     * Recalculates and caches the token count for the provided files.
     * This is only called when the selection changes, not on every keystroke.
     */
    public async recalculateFileTokens(selectedFiles: string[]): Promise<void> {
        this.recalculationPromise = (async () => {
            let fileTokens = 0;
            
            if (selectedFiles && selectedFiles.length > 0) {
                for (const filePath of selectedFiles) {
                    try {
                        const fileResult = await FileManager.getFileContent(filePath);

                        if (fileResult.kind === 'directory' || fileResult.kind === 'symlink') {
                            continue;
                        }

                        fileTokens += PromptGenerator.estimateTokens(fileResult.content);
                    } catch {
                        // Skip unreadable files
                        continue;
                    }
                }
            }
            
            this.cachedFileTokens = fileTokens;
        })();
        
        await this.recalculationPromise;
        this.recalculationPromise = null;
    }
}
