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
            getState: vi.fn().mockReturnValue({ favorites: [], translations: {}, prePrompt: '', instruction: '', postPrompt: '', selectedFiles: [] }),
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
        stateManager.getState.mockReturnValue({ favorites, translations: {} });
        
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

    it('should render favorite chips and handle clicks (selection)', () => {
        const favorites: Preset[] = [
            { id: 'fav1', name: 'Fav 1', content: 'C1', type: 'prePrompt' },
            { id: 'fav2', name: 'Fav 2', content: 'C2', type: 'prePrompt' }
        ];
        stateManager.getState.mockReturnValue({ favorites, translations: {} });
        section.update('', favorites, null); // Start unselected (0 selected because 2 available)

        const container = document.getElementById('favorites-prePrompt')!;
        const chip = container.querySelector('.favorite-chip') as HTMLElement;
        expect(chip).toBeTruthy();
        expect(chip.classList.contains('active')).toBe(false);

        chip.click();
        expect(ipc.postMessage).toHaveBeenCalledWith({
            type: IpcMessageId.SET_SELECTED_PRESET,
            payload: { id: 'fav1', type: 'prePrompt' }
        });
        
        // Re-query because renderFavorites recreates chips
        const newChip = container.querySelector('.favorite-chip') as HTMLElement;
        expect(newChip.classList.contains('active')).toBe(true);
    });
    
    it('should NOT auto-select if empty AFTER initialization', () => {
        const favorites: Preset[] = [{ id: 'fav1', name: 'Fav 1', content: 'Auto Content', type: 'prePrompt' }];
        const textarea = document.getElementById('prePrompt') as HTMLTextAreaElement;
        
        // 1. Initial update (should auto-fill)
        section.update('', favorites);
        expect(textarea.value).toBe('Auto Content');
        
        // 2. Clear manually (simulate user clearing)
        textarea.value = '';
        
        // 3. Subsequent update (should NOT auto-fill)
        section.update('', favorites);
        expect(textarea.value).toBe('');
    });

    it('should toggle selection: second click clears text and deselects', () => {
        const favorites: Preset[] = [{ id: 'fav1', name: 'Fav 1', content: 'C1', type: 'prePrompt' }];
        stateManager.getState.mockReturnValue({ favorites, translations: {} });
        
        // Initial setup - select it
        section.update('', favorites); // Should auto-select first one if empty and uninitialized
        const container = document.getElementById('favorites-prePrompt')!;
        const chip = container.querySelector('.favorite-chip') as HTMLElement;
        const textarea = document.getElementById('prePrompt') as HTMLTextAreaElement;
        
        expect(textarea.value).toBe('C1');
        expect(chip.classList.contains('active')).toBe(true);

        // First manual click (already selected, so it should toggle OFF)
        chip.click();
        expect(textarea.value).toBe('');
        expect(ipc.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: IpcMessageId.SET_SELECTED_PRESET,
            payload: { type: 'prePrompt', id: null }
        }));
    });

    it('should enter "Modified" state when text is edited and show save modal on click', () => {
        const favorites: Preset[] = [{ id: 'fav1', name: 'Fav 1', content: 'Original Content', type: 'prePrompt' }];
        stateManager.getState.mockReturnValue({ favorites, translations: {} });
        
        // 1. Select template
        section.update('', favorites);
        const textarea = document.getElementById('prePrompt') as HTMLTextAreaElement;
        const container = document.getElementById('favorites-prePrompt')!;
        let chip = container.querySelector('.favorite-chip') as HTMLElement;
        
        expect(textarea.value).toBe('Original Content');
        expect(chip.classList.contains('active')).toBe(true);
        expect(chip.dataset.tooltip).toBe('Original Content');

        // 2. Modify text
        textarea.value = 'Modified Content';
        section.update('Modified Content', favorites); // Trigger update with changed text
        
        chip = container.querySelector('.favorite-chip') as HTMLElement;
        expect(chip.classList.contains('active')).toBe(false);
        expect(chip.classList.contains('modified')).toBe(true);

        // 3. Click modified chip
        const showFavoriteModalSpy = vi.fn();
        (window as unknown as { showFavoriteModal: Mock }).showFavoriteModal = showFavoriteModalSpy;
        
        chip.click();
        expect(showFavoriteModalSpy).toHaveBeenCalledWith('prePrompt', 'Modified Content');
        
        // Text should NOT have changed (unlike the toggle behavior)
        expect(textarea.value).toBe('Modified Content');
    });

    it('should keep manage enabled for modified custom favorites', () => {
        const favorites: Preset[] = [{ id: 'fav1', name: 'Fav 1', content: 'Original Content', type: 'prePrompt' }];
        stateManager.getState.mockReturnValue({ favorites, translations: {} });

        section.update('', favorites, 'fav1');

        const textarea = document.getElementById('prePrompt') as HTMLTextAreaElement;
        textarea.value = 'Updated Content';
        section.update('Updated Content', favorites, 'fav1');

        const manageBtn = document.getElementById('manage-prePrompt') as HTMLButtonElement;
        expect(manageBtn.disabled).toBe(false);

        manageBtn.click();
        expect(ipc.postMessage).toHaveBeenCalledWith({
            type: IpcMessageId.MANAGE_PRESET,
            payload: { id: 'fav1', type: 'prePrompt', currentText: 'Updated Content' }
        });
    });

    it('should disable manage for built-in favorites even when selected', () => {
        const favorites: Preset[] = [{ id: 'built-in-intro-1', name: 'Built-in', content: 'Builtin', type: 'prePrompt' }];
        stateManager.getState.mockReturnValue({ favorites, translations: {} });

        section.update('', favorites, 'built-in-intro-1');

        const manageBtn = document.getElementById('manage-prePrompt') as HTMLButtonElement;
        expect(manageBtn.disabled).toBe(true);
    });
});
