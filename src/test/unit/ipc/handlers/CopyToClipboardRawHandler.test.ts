import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import { CopyToClipboardRawHandler } from '../../../../ipc/handlers/CopyToClipboardRawHandler.js';
import { IpcMessageId, WebviewMessage } from '../../../../types/index.js';
import { TestUtils } from '../../../testUtils.js';
import { IWebviewAccess } from '../../../../ipc/handlers/IWebviewAccess.js';

describe('CopyToClipboardRawHandler Unit Tests', () => {
    let mockWebview: Partial<IWebviewAccess> & { sendStatus: Mock };
    let handler: CopyToClipboardRawHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            sendStatus: vi.fn(),
            postMessage: vi.fn(),
            sendInitialState: vi.fn(),
            saveSelection: vi.fn(),
            savePresetId: vi.fn()
        };
        handler = new CopyToClipboardRawHandler(mockWebview as unknown as IWebviewAccess);
    });

    it('should copy raw text to clipboard', async () => {
        await handler.execute({
            type: IpcMessageId.COPY_TO_CLIPBOARD_RAW,
            payload: 'raw content'
        } as unknown as WebviewMessage);

        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('raw content');
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('success', expect.any(String));
    });

    it('should handle errors gracefully', async () => {
        vi.mocked(vscode.env.clipboard.writeText).mockRejectedValue(new Error('Clipboard error'));

        await handler.execute({
            type: IpcMessageId.COPY_TO_CLIPBOARD_RAW,
            payload: 'fail'
        } as unknown as WebviewMessage);

        expect(mockWebview.sendStatus).toHaveBeenCalledWith('error', expect.any(String));
    });

    it('should ignore non-COPY_TO_CLIPBOARD_RAW messages', async () => {
        await handler.execute({
            type: IpcMessageId.READY,
            payload: {}
        } as unknown as WebviewMessage);

        expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
    });
});
