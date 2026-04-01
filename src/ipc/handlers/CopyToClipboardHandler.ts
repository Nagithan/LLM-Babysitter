import * as vscode from 'vscode';
import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';
import { PromptGenerator } from '../../core/PromptGenerator.js';
import { LocaleManager } from '../../i18n/LocaleManager.js';
import { Logger } from '../../core/Logger.js';

/**
 * High-precision handler for prompt generation and clipboard operations.
 * Orchestrates template merging, file context injection
 */
export class CopyToClipboardHandler implements IIpcMessageHandler {
    private logger = Logger.getInstance();

    constructor(private webview: IWebviewAccess) { }

    async execute(message: WebviewMessage) {
        if (message.type === IpcMessageId.COPY_TO_CLIPBOARD) {
            const { prePrompt, instruction, postPrompt, selectedFiles } = message.payload;

            this.logger.info(`Generating prompt with ${selectedFiles.length} files...`);

            try {
                const prompt = await PromptGenerator.generate(
                    prePrompt,
                    instruction,
                    postPrompt,
                    selectedFiles
                );

                await vscode.env.clipboard.writeText(prompt);

                this.webview.sendStatus('success', LocaleManager.getTranslation('status.copied'));
            } catch (error: any) {
                this.logger.error(`Generation failed: ${error.message}`);
                this.webview.sendStatus('error', 'Prompt generation failed.');
            }
        }
    }
}
