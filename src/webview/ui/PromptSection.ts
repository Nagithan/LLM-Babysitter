import { IpcClient } from "./IpcClient.js";
import { StateManager } from "./StateManager.js";
import { IpcMessageId, Preset } from "../../types/index.js";

export class PromptSection {
    private textarea: HTMLTextAreaElement;
    private favoritesContainer: HTMLElement;
    private saveBtn: HTMLButtonElement;
    private manageBtn: HTMLButtonElement;
    private selectedPresetId: string | null = null;
    private lastSelectedPresetId: string | null = null;
    private isInitialized = false;

    constructor(
        private type: 'prePrompt' | 'instruction' | 'postPrompt',
        private ipc: IpcClient,
        private stateManager: StateManager
    ) {
        this.textarea = document.getElementById(type) as HTMLTextAreaElement;
        this.favoritesContainer = document.getElementById(`favorites-${type}`) as HTMLElement;
        this.saveBtn = document.getElementById(`save-${type}`) as HTMLButtonElement;
        this.manageBtn = document.getElementById(`manage-${type}`) as HTMLButtonElement;

        this.init();
    }

    private init() {
        this.textarea.addEventListener('input', () => {
            const text = this.textarea.value;
            this.stateManager.updateState({ [this.type]: text });
            this.ipc.postMessage({ type: IpcMessageId.UPDATE_TEXT, payload: { type: this.type, text } });
            this.adjustHeight();
            this.renderFavorites();
        });

        this.saveBtn.onclick = () => {
            const content = this.textarea.value;
            if (content.trim()) {
                (window as unknown as { showFavoriteModal: (type: string, content: string) => void }).showFavoriteModal(this.type, content);
            }
        };

        this.manageBtn.onclick = () => {
            if (!this.selectedPresetId) {return;}
            const favorite = this.stateManager.getState().favorites.find(f => f.id === this.selectedPresetId);
            if (favorite) {
                this.ipc.postMessage({ 
                    type: IpcMessageId.MANAGE_PRESET, 
                    payload: { id: favorite.id, type: this.type, currentText: this.textarea.value } 
                });
            }
        };
    }

    public update(text: string, favorites: Preset[], lastId?: string | null): void {
        const currentVal = this.textarea.value;
        if (text !== currentVal) {
            this.textarea.value = text;
            this.adjustHeight();
        }
        
        if (lastId !== undefined) {
            this.selectedPresetId = lastId;
            this.lastSelectedPresetId = lastId;
        }

        // Auto-select logic if empty - ONLY on initial load
        if (!this.isInitialized && !this.textarea.value.trim()) {
            const typeFavs = favorites.filter(f => f.type === this.type);
            if (this.selectedPresetId) {
                const saved = typeFavs.find(f => f.id === this.selectedPresetId);
                if (saved) {
                    this.textarea.value = saved.content;
                    this.lastSelectedPresetId = saved.id;
                    this.stateManager.updateState({ [this.type]: saved.content });
                }
            } else if (typeFavs.length === 1) {
                this.textarea.value = typeFavs[0].content;
                this.selectedPresetId = typeFavs[0].id;
                this.lastSelectedPresetId = typeFavs[0].id;
                this.stateManager.updateState({ [this.type]: typeFavs[0].content });
            }
        }

        this.isInitialized = true;
        this.renderFavorites();
    }

    private renderFavorites() {
        const favorites = this.stateManager.getState().favorites.filter(f => f.type === this.type);
        const currentText = this.textarea.value;

        // Determine which one truly matches the content right now
        const matchingFav = favorites.find(f => f.content === currentText);
        this.selectedPresetId = matchingFav ? matchingFav.id : null;
        
        // If content matches a template exactly, it becomes the last known base
        if (matchingFav) {
            this.lastSelectedPresetId = matchingFav.id;
        }

        this.favoritesContainer.textContent = '';
        favorites.forEach(fav => {
            const chip = document.createElement('div');
            chip.className = 'favorite-chip';
            
            const isActive = this.selectedPresetId === fav.id;
            const isModified = !isActive && this.lastSelectedPresetId === fav.id && currentText.trim().length > 0;

            if (isActive) {
                chip.classList.add('active');
            } else if (isModified) {
                chip.classList.add('modified');
                chip.title = 'Content modified - click to save as new favorite';
            } else {
                chip.title = fav.content;
            }

            chip.textContent = fav.name;
            chip.onclick = () => {
                if (isModified) {
                    // Re-clicking while modified asks to save
                    (window as unknown as { showFavoriteModal: (type: string, content: string) => void }).showFavoriteModal(this.type, currentText);
                    return;
                }

                const newText = isActive ? '' : fav.content;
                const newId = isActive ? null : fav.id;

                this.textarea.value = newText;
                this.selectedPresetId = newId;
                this.lastSelectedPresetId = newId;
                this.stateManager.updateState({ [this.type]: newText });
                
                if (this.type === 'prePrompt' || this.type === 'postPrompt') {
                    this.ipc.postMessage({ type: IpcMessageId.SET_SELECTED_PRESET, payload: { type: this.type, id: newId } });
                }

                this.ipc.postMessage({ type: IpcMessageId.UPDATE_TEXT, payload: { type: this.type, text: newText } });
                this.adjustHeight();
                this.renderFavorites();
            };
            this.favoritesContainer.appendChild(chip);
        });

        const hasActive = this.selectedPresetId !== null;
        this.manageBtn.style.opacity = hasActive ? '1' : '0.3';
        this.manageBtn.style.pointerEvents = hasActive ? 'all' : 'none';
        this.manageBtn.title = hasActive ? 'Manage Favorite' : 'Select a favorite to manage';
    }

    private adjustHeight() {
        requestAnimationFrame(() => {
            this.textarea.style.height = '0px';
            this.textarea.style.height = `${this.textarea.scrollHeight}px`;
        });
    }
}
