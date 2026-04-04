import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import * as vscode from 'vscode';
import { CopyToClipboardHandler } from '../../../../ipc/handlers/CopyToClipboardHandler.js';
import { IpcMessageId, WebviewMessage } from '../../../../types/index.js';
import { TestUtils } from '../../../testUtils.js';
import { IWebviewAccess } from '../../../../ipc/handlers/IWebviewAccess.js';
import { MockWorkspace } from '../../../mocks/vscode.js';

describe('CopyToClipboardHandler Unit Tests', () => {
    let mockWebview: Partial<IWebviewAccess> & { sendStatus: Mock };
    let handler: CopyToClipboardHandler;

    beforeEach(async () => {
        await TestUtils.fullReset();
        mockWebview = {
            sendStatus: vi.fn(),
            postMessage: vi.fn(),
            sendInitialState: vi.fn(),
            saveSelection: vi.fn(),
            savePresetId: vi.fn()
        };
        handler = new CopyToClipboardHandler(mockWebview as unknown as IWebviewAccess);
    });

    it('should generate prompt and copy to clipboard', async () => {
        const payload = {
            prePrompt: 'Pre',
            instruction: 'Instr',
            postPrompt: 'Post',
            selectedFiles: ['file1.ts']
        };

        // Mock workspace.fs.readFile to return content for PromptGenerator
        (vscode.workspace as unknown as MockWorkspace).setMockFile('/workspaces/project/file1.ts', 'file content');
        TestUtils.setupWorkspaceFolders([{ name: 'Project', path: '/workspaces/project' }]);

        await handler.execute({
            type: IpcMessageId.COPY_TO_CLIPBOARD,
            payload
        } as unknown as WebviewMessage);

        expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
        expect(mockWebview.sendStatus).toHaveBeenCalledWith('success', expect.any(String));
    });

    it('should handle errors gracefully', async () => {
        vi.mocked(vscode.env.clipboard.writeText).mockRejectedValue(new Error('Clipboard error'));

        await handler.execute({
            type: IpcMessageId.COPY_TO_CLIPBOARD,
            payload: { selectedFiles: [] }
        } as unknown as WebviewMessage);

        expect(mockWebview.sendStatus).toHaveBeenCalledWith('error', expect.any(String));
    });

    it('should ignore non-COPY_TO_CLIPBOARD messages', async () => {
        await handler.execute({
            type: IpcMessageId.READY,
            payload: {}
        } as unknown as WebviewMessage);

        expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
    });
});
