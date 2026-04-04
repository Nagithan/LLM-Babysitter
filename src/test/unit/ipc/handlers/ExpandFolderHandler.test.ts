import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpandFolderHandler } from '../../../../ipc/handlers/ExpandFolderHandler.js';
import { IpcMessageId } from '../../../../types/index.js';
import { FileManager } from '../../../../core/FileManager.js';
import { TestUtils } from '../../../testUtils.js';

describe('ExpandFolderHandler Unit Tests', () => {
    let mockWebview: any;
    let handler: ExpandFolderHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            postMessage: vi.fn(),
            sendStatus: vi.fn()
        };
        handler = new ExpandFolderHandler(mockWebview);
    });

    it('should fetch children for a folder and post to webview', async () => {
        const folderPath = 'Project/src';
        const mockChildren = [
            { name: 'main.ts', relativePath: 'Project/src/main.ts', isDirectory: false }
        ];

        vi.spyOn(FileManager, 'getFolderChildren').mockResolvedValue(mockChildren as any);

        await handler.execute({
            type: IpcMessageId.EXPAND_FOLDER,
            payload: folderPath
        });

        expect(FileManager.getFolderChildren).toHaveBeenCalledWith(folderPath);
        expect(mockWebview.postMessage).toHaveBeenCalledWith({
            type: 'folderChildren',
            payload: { parentPath: folderPath, children: mockChildren }
        });
    });

    it('should handle errors by sending error status and empty children', async () => {
        const folderPath = 'Invalid/Path';
        const error = new Error('Access Denied');

        vi.spyOn(FileManager, 'getFolderChildren').mockRejectedValue(error);

        await handler.execute({
            type: IpcMessageId.EXPAND_FOLDER,
            payload: folderPath
        });

        expect(mockWebview.sendStatus).toHaveBeenCalledWith('error', expect.stringContaining('Access Denied'));
        expect(mockWebview.postMessage).toHaveBeenCalledWith({
            type: 'folderChildren',
            payload: { parentPath: folderPath, children: [] }
        });
    });

    it('should ignore non-EXPAND_FOLDER messages', async () => {
        const spy = vi.spyOn(FileManager, 'getFolderChildren');
        await (handler as any).execute({
            type: IpcMessageId.READY,
            payload: {}
        });

        expect(spy).not.toHaveBeenCalled();
        expect(mockWebview.postMessage).not.toHaveBeenCalled();
    });
});
