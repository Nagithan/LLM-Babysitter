import { FileNode } from "../../types/index.js";
import { IpcClient } from "./IpcClient.js";
import { IpcMessageId } from "../../types/index.js";

export class FileTreeRenderer {
    private nodeDomMap: Map<string, HTMLElement> = new Map();
    private expandedPaths: Set<string> = new Set();
    private currentRoots: FileNode[] = [];
    private filter: string = '';

    constructor(
        private container: HTMLElement,
        private ipc: IpcClient,
        private selectedFiles: string[]
    ) {}

    public setSelectionSilent(selection: string[]): void {
        this.selectedFiles = selection;
    }

    public setFilter(filter: string): void {
        this.filter = filter.toLowerCase().trim();
        this.nodeDomMap.clear(); // Clear DOM map so nodes are rebuilt with filter applied
        this.render(this.currentRoots, true); // Force re-render on filter change
    }

    public render(roots: FileNode[] = [], force: boolean = false): void {
        if (roots.length > 0 && (roots !== this.currentRoots || force)) {
            this.currentRoots = roots;
            this.container.textContent = '';
            this.nodeDomMap.clear(); // Always clear DOM map on full render
            const fragment = document.createDocumentFragment();
            this.currentRoots.forEach(root => this.renderNode(root, fragment, this.filter));
            this.container.appendChild(fragment);
        } else {
            // Lightweight update: just refresh checkbox states in existing DOM
            this.refreshCheckboxes();
        }
    }

    private refreshCheckboxes(): void {
        this.nodeDomMap.forEach((item, path) => {
            const node = this.findNodeByPath(this.currentRoots, path);
            if (node) {
                const header = item.querySelector('.item-header');
                const checkbox = header?.querySelector('input[type="checkbox"]') as HTMLInputElement;
                if (checkbox) {
                    const state = this.getNodeSelectionState(node);
                    checkbox.checked = state.checked;
                    checkbox.indeterminate = state.indeterminate;
                }
            }
        });
    }

    private findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
        for (const node of nodes) {
            if (node.relativePath === path) { return node; }
            if (node.children) {
                const found = this.findNodeByPath(node.children, path);
                if (found) { return found; }
            }
        }
        return null;
    }

    private renderNode(node: FileNode, parent: Node, filter: string): boolean {
        const selfMatches = !filter || node.name.toLowerCase().includes(filter);
        const isFilterMode = filter.length > 0;
        
        let item = document.createElement('div');
        item.className = 'file-tree-item';
        this.nodeDomMap.set(node.relativePath, item);

        const header = document.createElement('div');
        header.className = 'item-header';
        item.appendChild(header);
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'item-children';
        item.appendChild(childrenContainer);

        let anyChildMatches = false;
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                if (this.renderNode(child, childrenContainer, filter)) {
                    anyChildMatches = true;
                }
            });
        }

        const shouldShow = !filter || selfMatches || anyChildMatches;
        item.style.display = shouldShow ? '' : 'none';
        if (!shouldShow) { return false; }

        // In filter mode, always show children; otherwise respect expandedPaths
        const isExpanded = isFilterMode ? anyChildMatches || selfMatches : this.expandedPaths.has(node.relativePath);
        item.classList.toggle('expanded', isExpanded);

        (item as any).dataset.path = node.relativePath;

        // Chevron
        if (node.isDirectory) {
            const chevron = document.createElement('span');
            chevron.className = `codicon codicon-chevron-${isExpanded ? 'down' : 'right'}`;
            chevron.style.fontSize = '12px';
            chevron.style.marginRight = '2px';
            chevron.onclick = (e) => {
                e.stopPropagation();
                this.toggleNode(node, item!, chevron);
            };
            header.appendChild(chevron);
        } else {
            const spacer = document.createElement('span');
            spacer.style.width = '14px';
            header.appendChild(spacer);
        }

        // Checkbox
        const selectState = this.getNodeSelectionState(node);
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectState.checked;
        checkbox.indeterminate = selectState.indeterminate;
        checkbox.onclick = (e) => e.stopPropagation();
        checkbox.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            this.handleToggle(node, target.checked);
        };
        header.appendChild(checkbox);

        // Icon
        const icon = document.createElement('span');
        icon.className = `codicon codicon-${this.getFileIcon(node)}`;
        icon.style.fontSize = '14px';
        icon.style.color = this.getIconColor(node);
        header.appendChild(icon);

        // Label (XSS SAFE HIGHLIGHTING)
        const label = document.createElement('span');
        label.className = 'item-label';
        if (filter && selfMatches) {
            const idx = node.name.toLowerCase().indexOf(filter);
            const before = node.name.substring(0, idx);
            const match = node.name.substring(idx, idx + filter.length);
            const after = node.name.substring(idx + filter.length);
            
            label.appendChild(document.createTextNode(before));
            const highlight = document.createElement('span');
            highlight.className = 'highlight';
            highlight.textContent = match;
            label.appendChild(highlight);
            label.appendChild(document.createTextNode(after));
        } else {
            label.textContent = node.name;
        }
        header.appendChild(label);

        header.onclick = () => {
            if (node.isDirectory) {
                const chevron = header.querySelector('.codicon') as HTMLElement;
                this.toggleNode(node, item!, chevron);
            } else {
                checkbox.checked = !checkbox.checked;
                this.handleToggle(node, checkbox.checked);
            }
        };

        parent.appendChild(item);
        return true;
    }

    private toggleNode(node: FileNode, item: HTMLElement, chevron: HTMLElement) {
        const expanded = item.classList.toggle('expanded');
        chevron.className = `codicon codicon-chevron-${expanded ? 'down' : 'right'}`;
        
        if (expanded) {
            this.expandedPaths.add(node.relativePath);
            if (node.isDirectory && (!node.children || node.children.length === 0)) {
                this.ipc.postMessage({ type: IpcMessageId.EXPAND_FOLDER, payload: node.relativePath });
            }
        } else {
            this.expandedPaths.delete(node.relativePath);
        }
    }

    private async handleToggle(node: FileNode, selected: boolean): Promise<void> {
        let selection = [...this.selectedFiles];

        const toggleRecursive = async (n: FileNode, s: boolean): Promise<void> => {
            if (n.isDirectory) {
                await this.ensureChildrenLoaded(n);
                if (n.children) {
                    for (const c of n.children) {
                        await toggleRecursive(c, s);
                    }
                }
            } else {
                if (s) {
                    if (!selection.includes(n.relativePath)) { selection.push(n.relativePath); }
                } else {
                    selection = selection.filter(p => p !== n.relativePath);
                }
            }
        };

        await toggleRecursive(node, selected);
        this.selectedFiles = selection;
        this.ipc.postMessage({ type: IpcMessageId.UPDATE_SELECTION, payload: selection });
        // Re-render from current roots to update indeterminate/checked states
        this.render(this.currentRoots, true);
    }

    private ensureChildrenLoaded(node: FileNode): Promise<void> {
        if (node.children && node.children.length > 0) { return Promise.resolve(); }
        return new Promise((resolve) => {
            const handler = (event: MessageEvent) => {
                const msg = event.data;
                if (msg.type === 'folderChildren' && msg.payload.parentPath === node.relativePath) {
                    window.removeEventListener('message', handler);
                    node.children = msg.payload.children;
                    resolve();
                }
            };
            window.addEventListener('message', handler);
            this.ipc.postMessage({ type: IpcMessageId.EXPAND_FOLDER, payload: node.relativePath });
            // Timeout safety
            setTimeout(() => { window.removeEventListener('message', handler); resolve(); }, 8000);
        });
    }

    private getNodeSelectionState(node: FileNode): { checked: boolean, indeterminate: boolean } {
        if (!node.isDirectory) {
            return { checked: this.selectedFiles.includes(node.relativePath), indeterminate: false };
        }
        
        // For directories, it's checked if all recursively-reachable files are selected
        if (!node.children || node.children.length === 0) {
            return { checked: false, indeterminate: false };
        }

        let checkedCount = 0;
        let indeterminateCount = 0;

        node.children.forEach(c => {
            const state = this.getNodeSelectionState(c);
            if (state.checked) { checkedCount++; }
            if (state.indeterminate) { indeterminateCount++; }
        });

        // Simplified logic: a directory is checked if all its IMMEDIATELY loaded children are checked
        if (checkedCount === node.children.length && checkedCount > 0) {
            return { checked: true, indeterminate: false };
        } else if (checkedCount > 0 || indeterminateCount > 0) {
            return { checked: false, indeterminate: true };
        } else {
            return { checked: false, indeterminate: false };
        }
    }

    private getFileIcon(node: FileNode): string {
        if (node.isDirectory) {return 'folder';}
        const ext = node.name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'json': return 'json';
            case 'md': return 'markdown';
            case 'ts':
            case 'js':
            case 'tsx':
            case 'jsx': return 'code';
            case 'html': return 'browser';
            case 'css':
            case 'scss': return 'symbol-color';
            default: return 'file';
        }
    }

    private getIconColor(node: FileNode): string {
        if (node.isDirectory) {return 'var(--vscode-list-highlightForeground)';}
        const ext = node.name.split('.').pop()?.toLowerCase();
        if (['ts', 'js', 'tsx', 'jsx'].includes(ext || '')) {return '#519aba';}
        if (ext === 'json') {return '#cbcb41';}
        if (ext === 'md') {return '#519aba';}
        return 'var(--vscode-foreground)';
    }

    public resetExpandedPaths(): void {
        this.expandedPaths.clear();
        this.nodeDomMap.clear();
    }

    public handleExpandCollapseAll(expand: boolean, allPaths: string[]): void {
        if (expand) {
            allPaths.forEach(p => this.expandedPaths.add(p));
        } else {
            this.expandedPaths.clear();
        }
        this.render(this.currentRoots, true);
    }
}
