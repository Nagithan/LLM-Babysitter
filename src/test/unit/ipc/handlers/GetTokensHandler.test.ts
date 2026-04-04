import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetTokensHandler } from '../../../../ipc/handlers/GetTokensHandler.js';
import { IpcMessageId } from '../../../../types/index.js';
import { PromptGenerator } from '../../../../core/PromptGenerator.js';
import { FileManager } from '../../../../core/FileManager.js';
import { TestUtils } from '../../../testUtils.js';

describe('GetTokensHandler Unit Tests', () => {
    let mockWebview: any;
    let handler: GetTokensHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            postMessage: vi.fn()
        };
        handler = new GetTokensHandler(mockWebview);
    });

    it('should calculate total tokens correctly for prompt and selected files', async () => {
        const text = 'Instructions';
        const selectedFiles = ['file1.js', 'file2.js'];

        vi.spyOn(PromptGenerator, 'estimateTokens').mockImplementation((input) => {
            if (input === 'Instructions') { return 10; }
            if (input === 'content1') { return 20; }
            if (input === 'content2') { return 30; }
            return 0;
        });

        vi.spyOn(FileManager, 'getFileContent').mockImplementation(async (path) => {
            if (path === 'file1.js') { return 'content1'; }
            if (path === 'file2.js') { return 'content2'; }
            return '';
        });

        await handler.execute({
            type: IpcMessageId.GET_TOKENS,
            payload: { text, selectedFiles }
        });

        expect(mockWebview.postMessage).toHaveBeenCalledWith({
            type: 'tokenUpdate',
            payload: {
                total: 60, // 10 + 20 + 30
                prompts: 10,
                files: 50
            }
        });
    });

    it('should handle unreadable files by skipping them', async () => {
        const text = 'Instructions';
        const selectedFiles = ['readable.js', 'missing.js'];

        vi.spyOn(PromptGenerator, 'estimateTokens').mockImplementation((input) => {
            if (input === 'Instructions') { return 10; }
            if (input === 'content') { return 20; }
            return 0;
        });

        vi.spyOn(FileManager, 'getFileContent').mockImplementation(async (path) => {
            if (path === 'readable.js') { return 'content'; }
            throw new Error('File not found');
        });

        await handler.execute({
            type: IpcMessageId.GET_TOKENS,
            payload: { text, selectedFiles }
        });

        expect(mockWebview.postMessage).toHaveBeenCalledWith({
            type: 'tokenUpdate',
            payload: {
                total: 30, // 10 + 20
                prompts: 10,
                files: 20
            }
        });
    });

    it('should ignore non-GET_TOKENS messages', async () => {
        await (handler as any).execute({
            type: IpcMessageId.READY,
            payload: {}
        });

        expect(mockWebview.postMessage).not.toHaveBeenCalled();
    });
});
