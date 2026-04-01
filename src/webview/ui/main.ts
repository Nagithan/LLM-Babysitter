import { AppState, WebviewMessage, ExtensionMessage, FileNode, IpcMessageId } from "../../types/index.js";
import { IpcClient } from "./IpcClient.js";
import { StateManager } from "./StateManager.js";
import { FileTreeRenderer } from "./FileTreeRenderer.js";
import { PromptSection } from "./PromptSection.js";

class BackseatPilotUI {
    private ipc = new IpcClient();
    private stateManager = new StateManager(this.ipc);
    
    private fileTreeRenderer: FileTreeRenderer;
    private sections: Record<string, PromptSection> = {};
    
    private debouncedSearch: any = null;

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
                    this.stateManager.setFileTree(message.payload.fileTree);
                    const { fileTree, ...rest } = message.payload;
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
        
        // Global Modal Logic (simplified)
        (window as any).showFavoriteModal = (type: string, content: string) => {
            const modal = document.getElementById('favorite-modal')!;
            modal.classList.add('visible');
            const input = document.getElementById('favorite-name') as HTMLInputElement;
            input.value = content.substring(0, 30).trim() + (content.length > 30 ? '...' : '');
            setTimeout(() => input.focus(), 150);

            const confirm = document.getElementById('confirm-favorite')!;
            confirm.onclick = () => {
                const name = input.value.trim();
                if (name) {
                    this.ipc.postMessage({ 
                        type: IpcMessageId.SAVE_PRESET, 
                        payload: { id: Date.now().toString(), name, content, type: type as any } 
                    });
                    modal.classList.remove('visible');
                }
            };
            const cancel = document.getElementById('cancel-favorite')!;
            cancel.onclick = () => modal.classList.remove('visible');
        };
    }

    private updateUI() {
        const state = this.stateManager.getState();
        const tree = this.stateManager.getFileTree();

        // Update Labels & Translations
        const t = state.translations;
        const app = document.getElementById('app')!;
        app.classList.remove('loading');

        ['prePrompt', 'instruction', 'postPrompt'].forEach(type => {
            const label = document.getElementById(`label-${type}`);
            if (label && t[`section.${type}`]) { label.textContent = t[`section.${type}`]; }
            this.sections[type].update(
                (state as any)[type], 
                state.favorites, 
                type === 'prePrompt' ? state.lastPrePromptId : (type === 'postPrompt' ? state.lastPostPromptId : undefined)
            );
        });

        // Update Renderers
        this.fileTreeRenderer.setSelection(state.selectedFiles);
        this.fileTreeRenderer.render(tree);

        // Update Token Count Trigger
        this.updateTokenCount();
    }

    private handleFolderChildren(parentPath: string, children: FileNode[]) {
        const tree = this.stateManager.getFileTree();
        const node = this.findNode(tree, parentPath);
        if (node) {
            node.children = children;
            this.fileTreeRenderer.render(tree);
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
            payload: { text, selectedFiles: state.selectedFiles }
        });
    }

    private updateTokenCounter(payload: { total: number; prompts: number; files: number }) {
        const countEl = document.getElementById('token-count');
        const container = document.getElementById('token-container');
        const barPrompts = document.getElementById('token-bar-prompts');
        const barFiles = document.getElementById('token-bar-files');

        if (countEl) { countEl.textContent = payload.total.toLocaleString(); }
        if (barPrompts) { barPrompts.style.width = `${Math.min(100, (payload.prompts / 128000) * 100)}%`; }
        if (barFiles) { barFiles.style.width = `${Math.min(100, (payload.files / 128000) * 100)}%`; }
        
        if (container) {
            container.classList.remove('warning', 'danger');
            if (payload.total >= 128000) { container.classList.add('danger'); }
            else if (payload.total >= 32000) { container.classList.add('warning'); }
        }
    }

    private handleSelectBatch(selected: boolean) {
        const tree = this.stateManager.getFileTree();
        let newSelection: string[] = [];
        if (selected) {
            const collect = (nodes: FileNode[]) => {
                nodes.forEach(n => {
                    if (!n.isDirectory) { newSelection.push(n.relativePath); }
                    if (n.children) { collect(n.children); }
                });
            };
            collect(tree);
        }
        this.stateManager.updateState({ selectedFiles: newSelection });
        this.ipc.postMessage({ type: IpcMessageId.UPDATE_SELECTION, payload: newSelection });
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

    private showStatus(message: string, status: 'success' | 'error') {
        const bar = document.getElementById('status-bar')!;
        bar.textContent = message;
        bar.className = `status-bar visible ${status}`;
        setTimeout(() => bar.className = 'status-bar', 3000);
    }
}

new BackseatPilotUI();
