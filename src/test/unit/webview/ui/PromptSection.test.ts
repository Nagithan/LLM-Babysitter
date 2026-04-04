/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { PromptSection } from '../../../../webview/ui/PromptSection.js';
import { IpcMessageId, Preset } from '../../../../types/index.js';
import { IpcClient } from '../../../../webview/ui/IpcClient.js';
import { StateManager } from '../../../../webview/ui/StateManager.js';
import { DeepPartial } from '../../../testUtils.js';

describe('PromptSection', () => {
    let ipc: DeepPartial<IpcClient>;
    let stateManager: DeepPartial<StateManager> & { updateState: Mock; getState: Mock };
    let section: PromptSection;

    beforeEach(() => {
        // Mock DOM
        document.body.innerHTML = `
            <textarea id="prePrompt"></textarea>
            <div id="favorites-prePrompt"></div>
            <button id="save-prePrompt"></button>
            <button id="manage-prePrompt"></button>
        `;

        ipc = { 
            postMessage: vi.fn(),
            onMessage: vi.fn().mockReturnValue({ dispose: vi.fn() })
        };
        stateManager = { 
            updateState: vi.fn(), 
            getState: vi.fn().mockReturnValue({ favorites: [], prePrompt: '', instruction: '', postPrompt: '', selectedFiles: [] }),
            subscribe: vi.fn()
        };

        (window as unknown as { showFavoriteModal: Mock }).showFavoriteModal = vi.fn();

        section = new PromptSection('prePrompt', ipc as unknown as IpcClient, stateManager as unknown as StateManager);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should handle input events', () => {
        const textarea = document.getElementById('prePrompt') as HTMLTextAreaElement;
        textarea.value = 'New value';
        textarea.dispatchEvent(new Event('input'));

        expect(stateManager.updateState).toHaveBeenCalledWith({ prePrompt: 'New value' });
        expect(ipc.postMessage).toHaveBeenCalledWith({
            type: IpcMessageId.UPDATE_TEXT,
            payload: { type: 'prePrompt', text: 'New value' }
        });
    });

    it('should show favorite modal on save click', () => {
        const textarea = document.getElementById('prePrompt') as HTMLTextAreaElement;
        textarea.value = 'Some content';
        const saveBtn = document.getElementById('save-prePrompt') as HTMLButtonElement;
        
        saveBtn.click();
        expect((window as unknown as { showFavoriteModal: Mock }).showFavoriteModal).toHaveBeenCalledWith('prePrompt', 'Some content');
    });

    it('should not show favorite modal on save click if empty', () => {
        const textarea = document.getElementById('prePrompt') as HTMLTextAreaElement;
        textarea.value = '';
        const saveBtn = document.getElementById('save-prePrompt') as HTMLButtonElement;
        
        saveBtn.click();
        expect((window as unknown as { showFavoriteModal: Mock }).showFavoriteModal).not.toHaveBeenCalled();
    });

    it('should trigger manage preset IPC', () => {
        const favorites: Preset[] = [{ id: 'fav1', name: 'Fav 1', content: 'content', type: 'prePrompt' }];
        stateManager.getState.mockReturnValue({ favorites });
        
        // Use update to set internal state
        section.update('', favorites, 'fav1');
        
        const manageBtn = document.getElementById('manage-prePrompt') as HTMLButtonElement;
        manageBtn.click();

        expect(ipc.postMessage).toHaveBeenCalledWith({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'fav1', type: 'prePrompt', currentText: 'content' }
        });
    });

    it('should auto-select single favorite if empty', () => {
        const favorites: Preset[] = [{ id: 'fav1', name: 'Fav 1', content: 'Auto Content', type: 'prePrompt' }];
        section.update('', favorites); // lastId is undefined

        const textarea = document.getElementById('prePrompt') as HTMLTextAreaElement;
        expect(textarea.value).toBe('Auto Content');
        expect(stateManager.updateState).toHaveBeenCalledWith({ prePrompt: 'Auto Content' });
    });

    it('should auto-select specific favorite if id provided and empty', () => {
        const favorites: Preset[] = [
            { id: 'fav1', name: 'Fav 1', content: 'C1', type: 'prePrompt' },
            { id: 'fav2', name: 'Fav 2', content: 'C2', type: 'prePrompt' }
        ];
        section.update('', favorites, 'fav2');

        const textarea = document.getElementById('prePrompt') as HTMLTextAreaElement;
        expect(textarea.value).toBe('C2');
    });

    it('should render favorite chips and handle clicks', () => {
        const favorites: Preset[] = [{ id: 'fav1', name: 'Fav 1', content: 'C1', type: 'prePrompt' }];
        stateManager.getState.mockReturnValue({ favorites });
        section.update('C1', favorites, 'fav1');

        const container = document.getElementById('favorites-prePrompt')!;
        const chip = container.querySelector('.favorite-chip') as HTMLElement;
        expect(chip).toBeTruthy();
        expect(chip.textContent).toBe('Fav 1');
        expect(chip.classList.contains('active')).toBe(true);

        chip.click();
        expect(ipc.postMessage).toHaveBeenCalledWith({
            type: IpcMessageId.SET_SELECTED_PRESET,
            payload: { id: 'fav1', type: 'prePrompt' }
        });
    });
});
