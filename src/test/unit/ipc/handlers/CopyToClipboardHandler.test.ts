import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { CopyToClipboardHandler } from '../../../../ipc/handlers/CopyToClipboardHandler.js';
import { IpcMessageId } from '../../../../types/index.js';
import { PromptGenerator } from '../../../../core/PromptGenerator.js';
import { LocaleManager } from '../../../../i18n/LocaleManager.js';
import { Logger } from '../../../../core/Logger.js';
import { TestUtils } from '../../../testUtils.js';

describe('CopyToClipboardHandler Unit Tests', () => {
    let mockWebview: any;
    let handler: CopyToClipboardHandler;
    let mockLogger: any;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            sendStatus: vi.fn()
        };
        mockLogger = {
            info: vi.fn(),
            error: vi.fn()
        };
        vi.spyOn(Logger, 'getInstance').mockReturnValue(mockLogger as any);
        vi.spyOn(LocaleManager, 'getTranslation').mockReturnValue('Copied!');
        
        handler = new CopyToClipboardHandler(mockWebview);
    });

    it('should generate prompt and write to clipboard', async () => {
        const payload = {
            prePrompt: 'Pre',
            instruction: 'Instr',
            postPrompt: 'Post',
            selectedFiles: ['file1.ts']
        };

        const generatedPrompt = 'Full Prompt Content';
        vi.spyOn(PromptGenerator, 'generate').mockResolvedValue(generatedPrompt);

        await handler.execute({
            type: IpcMessageId.COPY_TO_CLIPBOARD,
            payload
        });

        expect(PromptGenerator.generate).toHaveBeenCalledWith('Pre', 'Instr', 'Post', ['file1.ts']);
        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(generatedPrompt);
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('success', 'Copied!');
    });

    it('should handle generation errors gracefully', async () => {
        vi.spyOn(PromptGenerator, 'generate').mockRejectedValue(new Error('Generation Error'));

        await (handler as any).execute({
            type: IpcMessageId.COPY_TO_CLIPBOARD,
            payload: { selectedFiles: [] }
        });

        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Generation Error'));
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('error', 'Prompt generation failed.');
    });

    it('should ignore non-COPY_TO_CLIPBOARD messages', async () => {
        const spy = vi.spyOn(PromptGenerator, 'generate');
        await (handler as any).execute({
            type: IpcMessageId.READY,
            payload: {}
        });

        expect(spy).not.toHaveBeenCalled();
        expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
    });
});
