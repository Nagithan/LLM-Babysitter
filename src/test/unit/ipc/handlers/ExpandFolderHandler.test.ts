import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ExpandFolderHandler } from '../../../../ipc/handlers/ExpandFolderHandler.js';
import { IpcMessageId, WebviewMessage } from '../../../../types/index.js';
import { FileManager } from '../../../../core/FileManager.js';
import { TestUtils } from '../../../testUtils.js';
import { IWebviewAccess } from '../../../../ipc/handlers/IWebviewAccess.js';

describe('ExpandFolderHandler Unit Tests', () => {
    let mockWebview: Partial<IWebviewAccess> & { postMessage: Mock; sendStatus: Mock };
    let handler: ExpandFolderHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            postMessage: vi.fn(),
            sendStatus: vi.fn(),
            sendInitialState: vi.fn(),
            saveSelection: vi.fn(),
            savePresetId: vi.fn()
        };
        handler = new ExpandFolderHandler(mockWebview as unknown as IWebviewAccess);
        // Reset the spy on each test
        vi.spyOn(FileManager, 'getFolderChildren').mockResolvedValue([]);
    });

    it('should call getFolderChildren and post message', async () => {
        const mockChildren = [{ name: 'file.ts', relativePath: 'src/file.ts', isDirectory: false }];
        vi.spyOn(FileManager, 'getFolderChildren').mockResolvedValue(mockChildren);

        await handler.execute({
            type: IpcMessageId.EXPAND_FOLDER,
            payload: 'src'
        } as unknown as WebviewMessage);

        expect(FileManager.getFolderChildren).toHaveBeenCalledWith('src');
        expect(mockWebview.postMessage).toHaveBeenCalledWith({
            type: 'folderChildren',
            payload: {
                parentPath: 'src',
                children: mockChildren
            }
        });
    });

    it('should handle errors gracefully and clear loading state', async () => {
        vi.spyOn(FileManager, 'getFolderChildren').mockRejectedValue(new Error('FS Error'));

        await handler.execute({
            type: IpcMessageId.EXPAND_FOLDER,
            payload: 'src'
        } as unknown as WebviewMessage);

        expect(mockWebview.sendStatus).toHaveBeenCalledWith('error', expect.stringContaining('FS Error'));
        // Industrial-grade handler sends empty children to clear UI spinner
        expect(mockWebview.postMessage).toHaveBeenCalledWith({
            type: 'folderChildren',
            payload: {
                parentPath: 'src',
                children: []
            }
        });
    });

    it('should ignore non-EXPAND_FOLDER messages', async () => {
        await handler.execute({
            type: IpcMessageId.READY,
            payload: {}
        } as unknown as WebviewMessage);

        expect(FileManager.getFolderChildren).not.toHaveBeenCalled();
    });
});
