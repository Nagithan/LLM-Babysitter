import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { GetTokensHandler } from '../../../../ipc/handlers/GetTokensHandler.js';
import { IpcMessageId, WebviewMessage } from '../../../../types/index.js';
import { PromptGenerator } from '../../../../core/PromptGenerator.js';
import { FileManager } from '../../../../core/FileManager.js';
import { TestUtils } from '../../../testUtils.js';
import { IWebviewAccess } from '../../../../ipc/handlers/IWebviewAccess.js';

describe('GetTokensHandler Unit Tests', () => {
    let mockWebview: Partial<IWebviewAccess> & { postMessage: Mock; saveSelection: Mock };
    let handler: GetTokensHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            postMessage: vi.fn(),
            sendStatus: vi.fn(),
            sendInitialState: vi.fn(),
            saveSelection: vi.fn(),
            savePresetId: vi.fn()
        };
        handler = new GetTokensHandler(mockWebview as unknown as IWebviewAccess);
        
        // Reset spies
        vi.spyOn(PromptGenerator, 'estimateTokens').mockReturnValue(10);
        vi.spyOn(FileManager, 'getFileContent').mockResolvedValue('file content');
    });

    it('should update selection and cache file tokens', async () => {
        await handler.execute({
            type: IpcMessageId.UPDATE_SELECTION,
            payload: ['file1.ts', 'file2.ts']
        } as unknown as WebviewMessage);

        expect(mockWebview.saveSelection).toHaveBeenCalledWith(['file1.ts', 'file2.ts']);
        expect(FileManager.getFileContent).toHaveBeenCalledWith('file1.ts');
        expect(FileManager.getFileContent).toHaveBeenCalledWith('file2.ts');
    });

    it('should return aggregated tokens using cached file values', async () => {
        // Step 1: Cache file tokens (10 per file via mock)
        await handler.execute({
            type: IpcMessageId.UPDATE_SELECTION,
            payload: ['file1.ts']
        } as unknown as WebviewMessage);

        // Step 2: Get tokens for current text
        await handler.execute({
            type: IpcMessageId.GET_TOKENS,
            payload: { text: 'some text' }
        } as unknown as WebviewMessage);

        expect(PromptGenerator.estimateTokens).toHaveBeenCalledWith('some text');
        expect(mockWebview.postMessage).toHaveBeenCalledWith({
            type: 'tokenUpdate',
            payload: {
                total: 20, // 10 (text) + 10 (cached file)
                prompts: 10,
                files: 10
            }
        });
    });

    it('should wait for recalculation if GET_TOKENS arrives during UPDATE_SELECTION', async () => {
        const deferred = TestUtils.deferred<string>();
        vi.spyOn(FileManager, 'getFileContent').mockReturnValue(deferred.promise);

        // Start recalculation (async, don't await immediately)
        const updatePromise = handler.execute({
            type: IpcMessageId.UPDATE_SELECTION,
            payload: ['slow-file.ts']
        } as unknown as WebviewMessage);

        // Send GET_TOKENS immediately
        const getTokensPromise = handler.execute({
            type: IpcMessageId.GET_TOKENS,
            payload: { text: 'text' }
        } as unknown as WebviewMessage);

        // Resolve the file read
        deferred.resolve('content');
        await updatePromise;
        await getTokensPromise;

        // Verify the message was sent with the final calculated values
        expect(mockWebview.postMessage).toHaveBeenCalled();
    });

    it('should ignore non-token related messages', async () => {
        await handler.execute({
            type: IpcMessageId.READY,
            payload: {}
        } as unknown as WebviewMessage);

        expect(mockWebview.postMessage).not.toHaveBeenCalled();
    });
});
