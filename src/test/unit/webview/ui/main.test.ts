/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mocks must be defined before importing main.ts because it executes on load
(window as unknown as { acquireVsCodeApi: () => { postMessage: Mock; getState: Mock; setState: Mock } }).acquireVsCodeApi = vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    getState: vi.fn(),
    setState: vi.fn()
}));

const mockIpc = {
    postMessage: vi.fn(),
    onMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    ready: vi.fn()
};

const mockStateManager = {
    updateState: vi.fn(),
    getState: vi.fn().mockReturnValue({ 
        selectedFiles: [], 
        favorites: [], 
        translations: {},
        prePrompt: '',
        instruction: '',
        postPrompt: ''
    }),
    getFileTree: vi.fn().mockReturnValue([]),
    subscribe: vi.fn(),
    setFileTree: vi.fn()
};

const mockFileTreeRenderer = {
    render: vi.fn(),
    setFilter: vi.fn(),
    setLabels: vi.fn(),
    setSelectionSilent: vi.fn(),
    resetExpandedPaths: vi.fn(),
    resolvePendingRequest: vi.fn(),
    handleExpandCollapseAll: vi.fn()
};

const mockPromptSection = {
    update: vi.fn()
};

// Mocks must use regular functions to be used as constructors
vi.mock('../../../../webview/ui/IpcClient.js', () => ({
    IpcClient: vi.fn().mockImplementation(function() { return mockIpc; })
}));
vi.mock('../../../../webview/ui/StateManager.js', () => ({
    StateManager: vi.fn().mockImplementation(function() { return mockStateManager; })
}));
vi.mock('../../../../webview/ui/FileTreeRenderer.js', () => ({
    FileTreeRenderer: vi.fn().mockImplementation(function() { return mockFileTreeRenderer; })
}));
vi.mock('../../../../webview/ui/PromptSection.js', () => ({
    PromptSection: vi.fn().mockImplementation(function() { return mockPromptSection; })
}));

describe('LLMBabysitterUI', () => {
    beforeEach(async () => {
        vi.resetModules();
        
        document.body.innerHTML = `
            <div id="app" class="loading"></div>
            <div id="file-tree"></div>
            <input id="fileSearch" value="" />
            <textarea id="prePrompt"></textarea>
            <textarea id="instruction"></textarea>
            <textarea id="postPrompt"></textarea>
            <div id="favorites-prePrompt"></div>
            <div id="favorites-instruction"></div>
            <div id="favorites-postPrompt"></div>
            <button id="save-prePrompt"></button>
            <button id="save-instruction"></button>
            <button id="save-postPrompt"></button>
            <button id="manage-prePrompt"></button>
            <button id="manage-instruction"></button>
            <button id="manage-postPrompt"></button>
            <div id="label-prePrompt"></div>
            <div id="label-instruction"></div>
            <div id="label-postPrompt"></div>
            <div id="token-count"></div>
            <div id="token-container"></div>
            <div id="token-bar-prompts"></div>
            <div id="token-bar-files"></div>
            <div id="count-prompts"></div>
            <div id="count-files"></div>
            <button id="selectAll"></button>
            <button id="deselectAll"></button>
            <button id="copy-clipboard"></button>
            <div id="status-bar"></div>
            <div id="favorite-modal" class="overlay">
                <div class="modal">
                    <input id="favorite-name" />
                    <button id="cancel-favorite"></button>
                    <button id="confirm-favorite"></button>
                </div>
            </div>
        `;

        await import('../../../../webview/ui/main.js');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize and send ready signal', () => {
        expect(mockIpc.ready).toHaveBeenCalled();
        expect(mockStateManager.subscribe).toHaveBeenCalled();
    });

    it('should handle initState message', () => {
        const handler = mockIpc.onMessage.mock.calls[0][0];
        const payload = { fileTree: [], someUpdate: 'state' };
        handler({ type: 'initState', payload });
        expect(mockFileTreeRenderer.resetExpandedPaths).toHaveBeenCalled();
    });

    it('should handle stateUpdate message', () => {
        const handler = mockIpc.onMessage.mock.calls[0][0];
        handler({ type: 'stateUpdate', payload: { foo: 'bar' } });
        expect(mockStateManager.updateState).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should handle folderChildren message', () => {
        const handler = mockIpc.onMessage.mock.calls[0][0];
        const children = [{ name: 'child', relativePath: 'p/child', isDirectory: false }];
        mockStateManager.getFileTree.mockReturnValue([{ relativePath: 'p', children: [] }]);
        handler({ type: 'folderChildren', payload: { parentPath: 'p', children } });
        expect(mockFileTreeRenderer.resolvePendingRequest).toHaveBeenCalledWith('p');
        expect(mockFileTreeRenderer.render).toHaveBeenCalled();
    });

    it('should handle statusUpdate message', () => {
        vi.useFakeTimers();
        const handler = mockIpc.onMessage.mock.calls[0][0];
        handler({ type: 'statusUpdate', payload: { message: 'Success', status: 'success' } });
        const bar = document.getElementById('status-bar')!;
        expect(bar.textContent).toBe('Success');
        vi.runAllTimers();
        vi.useRealTimers();
    });

    it('should handle tokenUpdate message', () => {
        const handler = mockIpc.onMessage.mock.calls[0][0];
        handler({ type: 'tokenUpdate', payload: { total: 50000, prompts: 10000, files: 40000 } });
        const count = document.getElementById('token-count')!;
        expect(count.textContent).toContain('50,000');
        expect(document.getElementById('count-prompts')?.textContent).toContain('10,000');
        expect(document.getElementById('count-files')?.textContent).toContain('40,000');
    });

    it('should handle expandAll and collapseAll', () => {
        const handler = mockIpc.onMessage.mock.calls[0][0];
        mockStateManager.getFileTree.mockReturnValue([{ relativePath: 'root', isDirectory: true }]);
        handler({ type: 'expandAll' });
        expect(mockFileTreeRenderer.handleExpandCollapseAll).toHaveBeenCalledWith(true, ['root']);
    });

    it('should handle debounced search', () => {
        vi.useFakeTimers();
        const searchInput = document.getElementById('fileSearch') as HTMLInputElement;
        searchInput.value = 'query';
        searchInput.dispatchEvent(new Event('input'));
        vi.advanceTimersByTime(250);
        expect(mockFileTreeRenderer.setFilter).toHaveBeenCalledWith('query');
        vi.useRealTimers();
    });

    it('should handle selectAll batch', async () => {
        const selectBtn = document.getElementById('selectAll')!;
        mockStateManager.getFileTree.mockReturnValue([
            { relativePath: 'f1', isDirectory: false },
            { relativePath: 'd1', isDirectory: true, children: [{ relativePath: 'd1/f2', isDirectory: false }] }
        ]);

        // Ensure microtask queue is clear
        await Promise.resolve();
        selectBtn.dispatchEvent(new Event('click'));

        await vi.waitFor(() => {
            expect(mockStateManager.updateState).toHaveBeenCalled();
        }, { timeout: 3000 });
        
        expect(mockStateManager.updateState).toHaveBeenCalledWith(expect.objectContaining({
            selectedFiles: expect.arrayContaining(['f1', 'd1/f2'])
        }));
    });

    it('should handle deselectAll batch', () => {
        const deselectBtn = document.getElementById('deselectAll')!;
        deselectBtn.dispatchEvent(new Event('click'));
        expect(mockStateManager.updateState).toHaveBeenCalledWith({ selectedFiles: [] });
    });

    it('should handle copy to clipboard', () => {
        const copyBtn = document.getElementById('copy-clipboard')!;
        copyBtn.dispatchEvent(new Event('click'));
        expect(mockIpc.postMessage).toHaveBeenCalledWith({
            type: 'copyToClipboard',
            payload: expect.any(Object)
        });
    });

    it('should show favorite modal and handle confirm', () => {
        vi.useFakeTimers();
        (window as unknown as { showFavoriteModal: (type: string, content: string) => void }).showFavoriteModal('prePrompt', 'Some long content');
        const confirm = document.getElementById('confirm-favorite')!;
        confirm.dispatchEvent(new Event('click'));
        expect(mockIpc.postMessage).toHaveBeenCalledWith({
            type: 'savePreset',
            payload: expect.objectContaining({ type: 'prePrompt' })
        });
        vi.runAllTimers();
        vi.useRealTimers();
    });

    it('should trap focus in the favorite modal and restore focus on close', () => {
        vi.useFakeTimers();
        const trigger = document.getElementById('save-prePrompt') as HTMLButtonElement;
        const input = document.getElementById('favorite-name') as HTMLInputElement;
        const cancel = document.getElementById('cancel-favorite') as HTMLButtonElement;
        const confirm = document.getElementById('confirm-favorite') as HTMLButtonElement;

        trigger.focus();
        (window as unknown as { showFavoriteModal: (type: string, content: string) => void }).showFavoriteModal('prePrompt', 'Content');
        vi.advanceTimersByTime(150);

        expect(document.activeElement).toBe(input);

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
        expect(document.activeElement).toBe(confirm);

        confirm.focus();
        confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        expect(document.activeElement).toBe(input);

        cancel.focus();
        cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.activeElement).toBe(trigger);
        vi.useRealTimers();
    });
});
