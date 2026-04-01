import { IpcClient } from "./IpcClient.js";
import { StateManager } from "./StateManager.js";
import { IpcMessageId, Preset } from "../../types/index.js";

export class PromptSection {
    private textarea: HTMLTextAreaElement;
    private favoritesContainer: HTMLElement;
    private saveBtn: HTMLButtonElement;
    private manageBtn: HTMLButtonElement;
    private selectedPresetId: string | null = null;

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
                (window as any).showFavoriteModal(this.type, content);
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
        }

        // Auto-select logic if empty
        if (!this.textarea.value.trim()) {
            const typeFavs = favorites.filter(f => f.type === this.type);
            if (this.selectedPresetId) {
                const saved = typeFavs.find(f => f.id === this.selectedPresetId);
                if (saved) {
                    this.textarea.value = saved.content;
                    this.stateManager.updateState({ [this.type]: saved.content });
                }
            } else if (typeFavs.length === 1) {
                this.textarea.value = typeFavs[0].content;
                this.selectedPresetId = typeFavs[0].id;
                this.stateManager.updateState({ [this.type]: typeFavs[0].content });
            }
        }

        this.renderFavorites();
    }

    private renderFavorites() {
        const favorites = this.stateManager.getState().favorites.filter(f => f.type === this.type);
        const currentText = this.textarea.value;

        // Disambiguate active ID based on content
        const matchingIds = favorites.filter(f => f.content === currentText).map(f => f.id);
        if (!matchingIds.includes(this.selectedPresetId || '')) {
            this.selectedPresetId = matchingIds.length > 0 ? matchingIds[0] : null;
        }

        this.favoritesContainer.textContent = '';
        favorites.forEach(fav => {
            const chip = document.createElement('div');
            chip.className = 'favorite-chip';
            if (this.selectedPresetId === fav.id) {
                chip.classList.add('active');
            }
            chip.title = fav.content;
            chip.textContent = fav.name;
            chip.onclick = () => {
                this.textarea.value = fav.content;
                this.selectedPresetId = fav.id;
                this.stateManager.updateState({ [this.type]: fav.content });
                
                if (this.type === 'prePrompt' || this.type === 'postPrompt') {
                    this.ipc.postMessage({ type: IpcMessageId.SET_SELECTED_PRESET, payload: { type: this.type, id: fav.id } });
                }

                this.ipc.postMessage({ type: IpcMessageId.UPDATE_TEXT, payload: { type: this.type, text: fav.content } });
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
