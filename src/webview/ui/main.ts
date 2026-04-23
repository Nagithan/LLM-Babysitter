import { ExtensionMessage, FileNode, IpcMessageId, AppState } from "../../types/index.js";
import { IpcClient } from "./IpcClient.js";
import { StateManager } from "./StateManager.js";
import { FileTreeRenderer } from "./FileTreeRenderer.js";
import { PromptSection } from "./PromptSection.js";

class LLMBabysitterUI {
    private ipc = new IpcClient();
    private stateManager = new StateManager(this.ipc);
    
    private fileTreeRenderer: FileTreeRenderer;
    private sections: Record<string, PromptSection> = {};
    
    private debouncedSearch: ReturnType<typeof setTimeout> | null = null;
    private statusTimer: ReturnType<typeof setTimeout> | null = null;
    private closeFavoriteModal: (() => void) | null = null;
    private favoriteModalTrigger: HTMLElement | null = null;

    constructor() {
        this.fileTreeRenderer = new FileTreeRenderer(
            document.getElementById('file-tree')!,
            this.ipc,
            this.stateManager.getState().selectedFiles
        );

        // Initialize Sections
        this.sections.prePrompt = new PromptSection('prePrompt', this.ipc, this.stateManager);
        this.sections.instruction = new PromptSection('instruction', this.ipc, this.stateManager);
        this.sections.postPrompt = new PromptSection('postPrompt', this.ipc, this.stateManager);

        this.initEventListeners();
        this.stateManager.subscribe(() => this.updateUI());
        
        // Initial handshake
        this.ipc.ready();
    }

    private initEventListeners() {
        this.ipc.onMessage((message: ExtensionMessage) => {
            switch (message.type) {
                case 'initState':
                    // Full reset: clear expanded state to prevent stale tree display
                    this.fileTreeRenderer.resetExpandedPaths();
                    this.stateManager.setFileTree(message.payload.fileTree);
                    const { fileTree: _, ...rest } = message.payload;
                    this.stateManager.updateState(rest);
                    break;
                case 'stateUpdate':
                    this.stateManager.updateState(message.payload);
                    break;
                case 'folderChildren':
                    this.handleFolderChildren(message.payload.parentPath, message.payload.children);
                    break;
                case 'statusUpdate':
                    this.showStatus(message.payload.message, message.payload.status);
                    this.setCopyBusy(false);
                    break;
                case 'tokenUpdate':
                    this.updateTokenCounter(message.payload);
                    break;
                case 'expandAll':
                    this.handleExpandCollapseAll(true);
                    break;
                case 'collapseAll':
                    this.handleExpandCollapseAll(false);
                    break;
            }
        });

        const searchInput = document.getElementById('fileSearch') as HTMLInputElement;
        searchInput?.addEventListener('input', (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (this.debouncedSearch) {clearTimeout(this.debouncedSearch);}
            this.debouncedSearch = setTimeout(() => {
                this.fileTreeRenderer.setFilter(target.value);
            }, 250);
        });

        document.getElementById('selectAll')?.addEventListener('click', () => this.handleSelectBatch(true));
        document.getElementById('deselectAll')?.addEventListener('click', () => this.handleSelectBatch(false));
        document.getElementById('copy-clipboard')?.addEventListener('click', () => this.handleCopy());
        
        // Global Modal Logic
        (window as unknown as { showFavoriteModal: (type: string, content: string) => void }).showFavoriteModal = (type: string, content: string) => {
            const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            this.closeFavoriteModal?.();
            const modal = document.getElementById('favorite-modal')!;
            const dialog = modal.querySelector('.modal') as HTMLElement | null;
            this.favoriteModalTrigger = previouslyFocused;
            modal.classList.add('visible');
            const input = document.getElementById('favorite-name') as HTMLInputElement;
            input.value = content.substring(0, 30).trim() + (content.length > 30 ? '...' : '');
            setTimeout(() => {
                input.focus();
                input.select();
            }, 150);

            const confirm = document.getElementById('confirm-favorite')!;
            const cancel = document.getElementById('cancel-favorite')!;
            const getFocusableElements = () => {
                if (!dialog) { return [input, cancel, confirm].filter(Boolean) as HTMLElement[]; }
                return Array.from(dialog.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                ));
            };
            const close = () => {
                modal.classList.remove('visible');
                window.removeEventListener('keydown', handleKeydown);
                this.closeFavoriteModal = null;
                const trigger = this.favoriteModalTrigger;
                this.favoriteModalTrigger = null;
                trigger?.focus();
            };
            const save = () => {
                const name = input.value.trim();
                if (name) {
                    this.ipc.postMessage({ 
                        type: IpcMessageId.SAVE_PRESET, 
                        payload: { id: Date.now().toString(), name, content, type: type as 'prePrompt' | 'instruction' | 'postPrompt' } 
                    });
                    close();
                }
            };
            const handleKeydown = (event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    close();
                } else if (event.key === 'Tab') {
                    const focusable = getFocusableElements();
                    if (focusable.length === 0) { return; }
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    const active = document.activeElement as HTMLElement | null;

                    if (event.shiftKey && active === first) {
                        event.preventDefault();
                        last.focus();
                    } else if (!event.shiftKey && active === last) {
                        event.preventDefault();
                        first.focus();
                    }
                } else if (event.key === 'Enter' && (event.target === input || event.target === confirm)) {
                    event.preventDefault();
                    save();
                }
            };
            confirm.onclick = save;
            cancel.onclick = close;
            modal.onclick = (event: MouseEvent) => {
                if (event.target === modal) {
                    close();
                }
            };
            window.addEventListener('keydown', handleKeydown);
            this.closeFavoriteModal = close;
        };
    }

    private updateUI() {
        const state = this.stateManager.getState();
        const tree = this.stateManager.getFileTree();

        // Update Labels & Translations
        const t = state.translations;
        const app = document.getElementById('app')!;
        app.classList.remove('loading');
        this.applyTranslations(t);

        ['prePrompt', 'instruction', 'postPrompt'].forEach(type => {
            const label = document.getElementById(`label-${type}`);
            if (label && t[`section.${type}`]) { label.textContent = t[`section.${type}`]; }
            this.sections[type].update(
                state[type as keyof AppState] as string, 
                state.favorites, 
                type === 'prePrompt' ? state.lastPrePromptId : (type === 'postPrompt' ? state.lastPostPromptId : undefined)
            );
        });

        // Update Renderers
        // Order matters: set selection BEFORE rendering
        this.fileTreeRenderer.setSelectionSilent(state.selectedFiles);
        this.fileTreeRenderer.render(tree);

        // Update Token Count Trigger
        this.updateTokenCount();
    }

    private applyTranslations(t: Record<string, string>) {
        document.documentElement.lang = t['app.lang'] || 'en';

        const textTargets: Record<string, string> = {
            'label-files': 'section.files',
            'copy-label': 'button.copy',
            'token-label': 'tokens.label',
            'breakdown-label-prompts': 'tokens.prompts',
            'breakdown-label-files': 'tokens.files',
            'modal-title': 'modal.favoriteTitle',
            'cancel-favorite': 'button.cancel',
            'confirm-favorite': 'button.save'
        };

        Object.entries(textTargets).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el && t[key]) { el.textContent = t[key]; }
        });

        const fileSearch = document.getElementById('fileSearch') as HTMLInputElement | null;
        if (fileSearch && t['files.search']) {
            fileSearch.placeholder = t['files.search'];
            fileSearch.setAttribute('aria-label', t['files.search']);
        }

        this.fileTreeRenderer.setLabels({
            emptyTree: t['files.empty'] || 'No files found.',
            emptyFilter: t['files.emptySearch'] || 'No files found matching search.',
            treeAriaLabel: t['files.treeAriaLabel'] || t['section.files'] || 'Workspace file selection tree'
        });

        const favoriteName = document.getElementById('favorite-name') as HTMLInputElement | null;
        if (favoriteName && t['modal.favoritePlaceholder']) {
            favoriteName.placeholder = t['modal.favoritePlaceholder'];
        }

        const tooltipTargets: Record<string, string> = {
            'help-prePrompt': 'tooltip.prePrompt',
            'help-instruction': 'tooltip.instruction',
            'help-files': 'tooltip.files',
            'help-postPrompt': 'tooltip.postPrompt',
            'save-prePrompt': 'button.addFavorite',
            'save-instruction': 'button.addFavorite',
            'save-postPrompt': 'button.addFavorite',
            'manage-prePrompt': 'button.manageFavorite',
            'manage-instruction': 'button.manageFavorite',
            'manage-postPrompt': 'button.manageFavorite',
            'selectAll': 'files.selectAll',
            'deselectAll': 'files.deselectAll'
        };

        Object.entries(tooltipTargets).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (!el || !t[key]) { return; }
            el.dataset.tooltip = t[key];
            el.setAttribute('aria-label', t[key]);
        });
    }

    private handleFolderChildren(parentPath: string, children: FileNode[]) {
        this.fileTreeRenderer.resolvePendingRequest(parentPath);
        const tree = this.stateManager.getFileTree();
        const node = this.findNode(tree, parentPath);
        if (node) {
            node.children = children;
            this.fileTreeRenderer.render(tree, true);
        }
    }

    private findNode(nodes: FileNode[], path: string): FileNode | null {
        for (const node of nodes) {
            if (node.relativePath === path) {return node;}
            if (node.children) {
                const found = this.findNode(node.children, path);
                if (found) {return found;}
            }
        }
        return null;
    }

    private updateTokenCount() {
        const state = this.stateManager.getState();
        const text = state.prePrompt + state.instruction + state.postPrompt;
        this.ipc.postMessage({ 
            type: IpcMessageId.GET_TOKENS, 
            payload: { text }
        });
    }

    private updateTokenCounter(payload: { total: number; prompts: number; files: number }) {
        const countEl = document.getElementById('token-count');
        const container = document.getElementById('token-container');
        const barPrompts = document.getElementById('token-bar-prompts');
        const barFiles = document.getElementById('token-bar-files');
        const promptsEl = document.getElementById('count-prompts');
        const filesEl = document.getElementById('count-files');
        const tokenLimit = 128000;

        if (countEl) { countEl.textContent = payload.total.toLocaleString(); }
        if (promptsEl) { promptsEl.textContent = payload.prompts.toLocaleString(); }
        if (filesEl) { filesEl.textContent = payload.files.toLocaleString(); }

        const promptPercent = Math.min(100, (payload.prompts / tokenLimit) * 100);
        const filePercent = Math.min(Math.max(0, 100 - promptPercent), (payload.files / tokenLimit) * 100);
        if (barPrompts) {
            barPrompts.style.width = `${promptPercent}%`;
            barPrompts.style.flexBasis = `${promptPercent}%`;
        }
        if (barFiles) {
            barFiles.style.width = `${filePercent}%`;
            barFiles.style.flexBasis = `${filePercent}%`;
        }
        
        if (container) {
            container.classList.remove('warning', 'danger');
            container.setAttribute('aria-label', `${payload.total.toLocaleString()} tokens`);
            if (payload.total >= tokenLimit) { container.classList.add('danger'); }
            else if (payload.total >= 32000) { container.classList.add('warning'); }
        }
    }

    private async handleSelectBatch(selected: boolean): Promise<void> {
        if (!selected) {
            this.stateManager.updateState({ selectedFiles: [] });
            this.ipc.postMessage({ type: IpcMessageId.UPDATE_SELECTION, payload: [] });
            return;
        }

        // Show loading indicator
        const selectBtn = document.getElementById('selectAll') as HTMLButtonElement;
        const translations = this.stateManager.getState().translations;
        const selectAllLabel = translations['files.selectAll'] || 'Select All';
        if (selectBtn) {
            const busyLabel = translations['status.selecting'] || 'Selecting files...';
            selectBtn.disabled = true;
            selectBtn.classList.add('busy');
            selectBtn.setAttribute('aria-busy', 'true');
            selectBtn.setAttribute('aria-label', busyLabel);
            selectBtn.dataset.tooltip = busyLabel;
        }

        const tree = this.stateManager.getFileTree();
        const allFiles: string[] = [];

        const deepCollect = async (nodes: FileNode[]): Promise<void> => {
            for (const n of nodes) {
                if (!n.isDirectory) {
                    allFiles.push(n.relativePath);
                } else {
                    // Fetch children if not loaded
                    if (n.children === undefined) {
                        try {
                            const children = await this.fetchFolderChildren(n.relativePath);
                            n.children = children;
                        } catch { continue; }
                    }
                    if (n.children) {
                        await deepCollect(n.children);
                    }
                }
            }
        };

        try {
            await deepCollect(tree);
            this.stateManager.updateState({ selectedFiles: allFiles });
            this.ipc.postMessage({ type: IpcMessageId.UPDATE_SELECTION, payload: allFiles });
        } finally {
            if (selectBtn) {
                selectBtn.disabled = false;
                selectBtn.classList.remove('busy');
                selectBtn.removeAttribute('aria-busy');
                selectBtn.setAttribute('aria-label', selectAllLabel);
                selectBtn.dataset.tooltip = selectAllLabel;
            }
        }
    }

    private fetchFolderChildren(folderPath: string): Promise<FileNode[]> {
        return new Promise((resolve) => {
            const handler = (event: MessageEvent) => {
                const msg = event.data;
                if (msg.type === 'folderChildren' && msg.payload.parentPath === folderPath) {
                    clearTimeout(timeout);
                    window.removeEventListener('message', handler);
                    // Also update the tree node in state manager
                    const node = this.findNode(this.stateManager.getFileTree(), folderPath);
                    if (node) { node.children = msg.payload.children; }
                    resolve(msg.payload.children);
                }
            };
            const timeout = setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve([]);
            }, 10000);

            window.addEventListener('message', handler);
            this.ipc.postMessage({ type: IpcMessageId.EXPAND_FOLDER, payload: folderPath });
        });
    }

    private handleExpandCollapseAll(expand: boolean) {
        const tree = this.stateManager.getFileTree();
        const allPaths: string[] = [];
        const collect = (nodes: FileNode[]) => {
            nodes.forEach(n => {
                if (n.isDirectory) {
                    allPaths.push(n.relativePath);
                    if (n.children) { collect(n.children); }
                }
            });
        };
        collect(tree);
        this.fileTreeRenderer.handleExpandCollapseAll(expand, allPaths);
    }

    private handleCopy() {
        const state = this.stateManager.getState();
        this.setCopyBusy(true);
        this.ipc.postMessage({
            type: IpcMessageId.COPY_TO_CLIPBOARD,
            payload: {
                prePrompt: state.prePrompt,
                instruction: state.instruction,
                postPrompt: state.postPrompt,
                selectedFiles: state.selectedFiles
            }
        });
    }

    private setCopyBusy(isBusy: boolean) {
        const button = document.getElementById('copy-clipboard') as HTMLButtonElement | null;
        if (!button) { return; }
        button.disabled = isBusy;
        button.classList.toggle('busy', isBusy);
        if (isBusy) {
            button.setAttribute('aria-busy', 'true');
        } else {
            button.removeAttribute('aria-busy');
        }
    }

    private showStatus(message: string, status: 'success' | 'error') {
        const bar = document.getElementById('status-bar')!;
        bar.textContent = message;
        bar.className = `status-bar visible ${status}`;
        if (this.statusTimer) { clearTimeout(this.statusTimer); }
        this.statusTimer = setTimeout(() => {
            bar.className = 'status-bar';
            this.statusTimer = null;
        }, 3000);
    }
}

new LLMBabysitterUI();
