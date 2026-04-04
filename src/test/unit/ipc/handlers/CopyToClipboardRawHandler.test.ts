import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { CopyToClipboardRawHandler } from '../../../../ipc/handlers/CopyToClipboardRawHandler.js';
import { IpcMessageId } from '../../../../types/index.js';
import { LocaleManager } from '../../../../i18n/LocaleManager.js';
import { TestUtils } from '../../../testUtils.js';

describe('CopyToClipboardRawHandler Unit Tests', () => {
    let mockWebview: any;
    let handler: CopyToClipboardRawHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            sendStatus: vi.fn()
        };
        vi.spyOn(LocaleManager, 'getTranslation').mockReturnValue('Copied!');
        handler = new CopyToClipboardRawHandler(mockWebview);
    });

    it('should write raw text to clipboard', async () => {
        const text = 'Raw Text content';
        await handler.execute({
            type: IpcMessageId.COPY_TO_CLIPBOARD_RAW,
            payload: text
        });

        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(text);
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('success', 'Copied!');
    });

    it('should ignore non-COPY_TO_CLIPBOARD_RAW messages', async () => {
        await (handler as any).execute({
            type: IpcMessageId.READY,
            payload: {}
        });

        expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
    });
});
