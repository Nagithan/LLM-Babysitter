import { FileNode } from "../../types/index.js";
import { IpcClient } from "./IpcClient.js";
import { IpcMessageId } from "../../types/index.js";

interface SelectionStats {
    selectedFiles: number;
    totalFiles: number;
    hasUnknownDescendants: boolean;
}

interface TreeLabels {
    emptyTree: string;
    emptyFilter: string;
    treeAriaLabel: string;
}

export class FileTreeRenderer {
    private nodeDomMap: Map<string, HTMLElement> = new Map();
    private expandedPaths: Set<string> = new Set();
    private pendingExpansionRequests: Set<string> = new Set();
    private pendingExpansionTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private currentRoots: FileNode[] = [];
    private filter: string = '';
    private expandAllMode = false;
    private labels: TreeLabels = {
        emptyTree: 'No files found.',
        emptyFilter: 'No files found matching search.',
        treeAriaLabel: 'Workspace file selection tree'
    };

    constructor(
        private container: HTMLElement,
        private ipc: IpcClient,
        private selectedFiles: string[]
    ) {
        this.container.setAttribute('role', 'tree');
        this.container.setAttribute('aria-label', this.labels.treeAriaLabel);
    }

    public setSelectionSilent(selection: string[]): void {
        this.selectedFiles = selection;
    }

    public setLabels(labels: Partial<TreeLabels>): void {
        this.labels = { ...this.labels, ...labels };
        this.container.setAttribute('aria-label', this.labels.treeAriaLabel);
    }

    public resolvePendingRequest(path: string): void {
        this.pendingExpansionRequests.delete(path);
        const timeout = this.pendingExpansionTimeouts.get(path);
        if (timeout) {
            clearTimeout(timeout);
            this.pendingExpansionTimeouts.delete(path);
        }
        this.updateContainerBusyState();
    }

    public setFilter(filter: string): void {
        this.filter = filter.toLowerCase().trim();
        this.nodeDomMap.clear(); // Clear DOM map so nodes are rebuilt with filter applied
        this.render(this.currentRoots, true); // Force re-render on filter change
    }

    public render(roots: FileNode[] = [], force: boolean = false): void {
        if (roots.length === 0) {
            this.currentRoots = [];
            this.nodeDomMap.clear();
            this.showEmptyState(this.filter ? this.labels.emptyFilter : this.labels.emptyTree);
            this.updateContainerBusyState();
            return;
        }

        if (roots !== this.currentRoots || force) {
            this.currentRoots = roots;
            this.container.textContent = '';
            this.nodeDomMap.clear(); // Always clear DOM map on full render
            const fragment = document.createDocumentFragment();
            let visibleRootCount = 0;
            this.currentRoots.forEach(root => {
                if (this.renderNode(root, fragment, this.filter, 1)) {
                    visibleRootCount++;
                }
            });

            if (visibleRootCount === 0) {
                this.showEmptyState(this.filter ? this.labels.emptyFilter : this.labels.emptyTree);
            } else {
                this.container.appendChild(fragment);
            }
        } else {
            // Lightweight update: just refresh checkbox states in existing DOM
            this.refreshCheckboxes();
        }

        this.updateContainerBusyState();
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
                    header?.setAttribute('aria-selected', String(state.checked || state.indeterminate));
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

    private renderNode(node: FileNode, parent: Node, filter: string, depth: number): boolean {
        const selfMatches = !filter || node.name.toLowerCase().includes(filter);
        const isFilterMode = filter.length > 0;
        const shouldSearchChildren = isFilterMode && node.isDirectory && !this.isLoaded(node);
        
        const item = document.createElement('div');
        item.className = 'file-tree-item';
        item.dataset.path = node.relativePath;

        const header = document.createElement('div');
        header.className = 'item-header';
        header.tabIndex = 0;
        header.setAttribute('role', 'treeitem');
        header.setAttribute('aria-level', String(depth));
        header.setAttribute('aria-label', node.name);
        item.appendChild(header);
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'item-children';
        childrenContainer.setAttribute('role', 'group');
        item.appendChild(childrenContainer);

        let anyChildMatches = false;
        if (shouldSearchChildren) {
            this.requestFolderChildren(node.relativePath);
        }

        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                if (this.renderNode(child, childrenContainer, filter, depth + 1)) {
                    anyChildMatches = true;
                }
            });
        }

        const shouldShow = !filter || selfMatches || anyChildMatches || shouldSearchChildren;
        if (!shouldShow) { return false; }
        this.nodeDomMap.set(node.relativePath, item);

        if (this.expandAllMode && node.isDirectory && !isFilterMode) {
            this.expandedPaths.add(node.relativePath);
        }

        const isExpanded = node.isDirectory && (
            isFilterMode
                ? anyChildMatches || selfMatches || shouldSearchChildren
                : this.expandedPaths.has(node.relativePath)
        );
        item.classList.toggle('expanded', isExpanded);
        if (node.isDirectory) {
            header.setAttribute('aria-expanded', String(isExpanded));
        } else {
            header.removeAttribute('aria-expanded');
        }

        const isLoaded = this.isLoaded(node);
        const hasVisibleChildren = node.children?.some(child => this.shouldShowNode(child, filter)) ?? false;
        const isEffectivelyEmpty = node.isDirectory && isLoaded && !hasVisibleChildren;
        // A directory is disabled if it's expanded and shows no items, or if it was loaded and is truly empty
        const isDisabled = isEffectivelyEmpty && (isExpanded || (isLoaded && node.children!.length === 0));
        
        if (isDisabled) {
            header.classList.add('disabled');
        }

        if (node.isDirectory && isExpanded && !isLoaded && !isFilterMode) {
            this.requestFolderChildren(node.relativePath);
        }

        // Chevron
        let chevron: HTMLElement | null = null;
        if (node.isDirectory) {
            chevron = document.createElement('span');
            chevron.className = `codicon codicon-chevron-${isExpanded ? 'down' : 'right'}`;
            chevron.style.fontSize = '12px';
            chevron.style.marginRight = '2px';
            chevron.onclick = (e) => {
                e.stopPropagation();
                if (isDisabled && !isExpanded) {return;} // Don't try to expand if we know it's empty and collapsed (shouldn't happen with chevron logic)
                if (!chevron) {return;}
                this.toggleNode(node, item, chevron);
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
        checkbox.disabled = isDisabled;
        checkbox.setAttribute('aria-label', node.isDirectory ? `Select folder ${node.name}` : `Select file ${node.name}`);
        checkbox.onclick = (e) => e.stopPropagation();
        checkbox.onchange = (e) => {
            if (isDisabled) {return;}
            const target = e.target as HTMLInputElement;
            this.handleToggle(node, target.checked);
        };
        header.appendChild(checkbox);
        header.setAttribute('aria-selected', String(selectState.checked || selectState.indeterminate));

        // Icon
        const icon = document.createElement('span');
        icon.className = `codicon codicon-${this.getFileIcon(node)}`;
        icon.style.fontSize = '14px';
        icon.style.color = isDisabled ? 'var(--vscode-disabledForeground)' : this.getIconColor(node);
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
            if (isDisabled) {return;}
            if (node.isDirectory) {
                if (chevron) {
                    this.toggleNode(node, item, chevron);
                }
            } else {
                checkbox.checked = !checkbox.checked;
                this.handleToggle(node, checkbox.checked);
            }
        };
        header.onkeydown = (event) => this.handleKeyDown(event, node, item, childrenContainer, chevron, checkbox);

        parent.appendChild(item);
        return true;
    }

    private toggleNode(node: FileNode, item: HTMLElement, chevron: HTMLElement) {
        const expanded = item.classList.toggle('expanded');
        chevron.className = `codicon codicon-chevron-${expanded ? 'down' : 'right'}`;
        const header = item.querySelector(':scope > .item-header') as HTMLElement | null;
        header?.setAttribute('aria-expanded', String(expanded));
        
        if (expanded) {
            this.expandedPaths.add(node.relativePath);
            if (node.isDirectory && !this.isLoaded(node)) {
                this.requestFolderChildren(node.relativePath);
            }
        } else {
            this.expandedPaths.delete(node.relativePath);
        }
    }

    private handleKeyDown(
        event: KeyboardEvent,
        node: FileNode,
        item: HTMLElement,
        childrenContainer: HTMLElement,
        chevron: HTMLElement | null,
        checkbox: HTMLInputElement
    ): void {
        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault();
                item.querySelector<HTMLElement>(':scope > .item-header')?.click();
                break;
            case 'ArrowRight':
                if (!node.isDirectory || !chevron) { return; }
                event.preventDefault();
                if (!item.classList.contains('expanded')) {
                    this.toggleNode(node, item, chevron);
                } else {
                    this.focusFirstChild(childrenContainer);
                }
                break;
            case 'ArrowLeft':
                event.preventDefault();
                if (node.isDirectory && item.classList.contains('expanded') && chevron) {
                    this.toggleNode(node, item, chevron);
                } else {
                    this.focusParentItem(item);
                }
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.focusRelativeHeader(item, 1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.focusRelativeHeader(item, -1);
                break;
            case 'Home':
                event.preventDefault();
                this.focusBoundaryHeader('first');
                break;
            case 'End':
                event.preventDefault();
                this.focusBoundaryHeader('last');
                break;
            default:
                if (!node.isDirectory && (event.key === 'Spacebar')) {
                    event.preventDefault();
                    checkbox.checked = !checkbox.checked;
                    this.handleToggle(node, checkbox.checked);
                }
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
        if (this.isLoaded(node)) { return Promise.resolve(); }
        return new Promise((resolve) => {
            const handler = (event: MessageEvent) => {
                const msg = event.data;
                if (msg.type === 'folderChildren' && msg.payload.parentPath === node.relativePath) {
                    clearTimeout(timeout);
                    window.removeEventListener('message', handler);
                    this.resolvePendingRequest(node.relativePath);
                    node.children = msg.payload.children;
                    resolve();
                }
            };
            window.addEventListener('message', handler);
            this.requestFolderChildren(node.relativePath);
            // Timeout safety
            const timeout = setTimeout(() => {
                window.removeEventListener('message', handler);
                this.resolvePendingRequest(node.relativePath);
                resolve();
            }, 8000);
        });
    }

    private getNodeSelectionState(node: FileNode): { checked: boolean, indeterminate: boolean } {
        const state = this.getSelectionStats(node);

        if (state.totalFiles === 0) {
            return { checked: false, indeterminate: false };
        }

        if (!state.hasUnknownDescendants && state.selectedFiles === state.totalFiles) {
            return { checked: true, indeterminate: false };
        }

        return {
            checked: false,
            indeterminate: state.selectedFiles > 0
        };
    }

    private getSelectionStats(node: FileNode): SelectionStats {
        if (!node.isDirectory) {
            return {
                selectedFiles: this.selectedFiles.includes(node.relativePath) ? 1 : 0,
                totalFiles: 1,
                hasUnknownDescendants: false
            };
        }

        if (!this.isLoaded(node)) {
            return { selectedFiles: 0, totalFiles: 0, hasUnknownDescendants: true };
        }

        return (node.children ?? []).reduce<SelectionStats>((acc, child) => {
            const childStats = this.getSelectionStats(child);
            return {
                selectedFiles: acc.selectedFiles + childStats.selectedFiles,
                totalFiles: acc.totalFiles + childStats.totalFiles,
                hasUnknownDescendants: acc.hasUnknownDescendants || childStats.hasUnknownDescendants
            };
        }, { selectedFiles: 0, totalFiles: 0, hasUnknownDescendants: false });
    }

    private shouldShowNode(node: FileNode, filter: string): boolean {
        if (!filter) { return true; }
        if (node.name.toLowerCase().includes(filter)) { return true; }
        return node.children?.some(child => this.shouldShowNode(child, filter)) ?? false;
    }

    private isLoaded(node: FileNode): boolean {
        return node.children !== undefined;
    }

    private requestFolderChildren(path: string): void {
        if (this.pendingExpansionRequests.has(path)) { return; }
        this.pendingExpansionRequests.add(path);
        this.updateContainerBusyState();
        this.ipc.postMessage({ type: IpcMessageId.EXPAND_FOLDER, payload: path });

        const timeout = setTimeout(() => {
            this.pendingExpansionRequests.delete(path);
            this.pendingExpansionTimeouts.delete(path);
            this.updateContainerBusyState();
        }, 15000);
        this.pendingExpansionTimeouts.set(path, timeout);
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
        this.pendingExpansionRequests.clear();
        this.pendingExpansionTimeouts.forEach(timeout => clearTimeout(timeout));
        this.pendingExpansionTimeouts.clear();
        this.expandAllMode = false;
        this.updateContainerBusyState();
    }

    public handleExpandCollapseAll(expand: boolean, allPaths: string[]): void {
        this.expandAllMode = expand;
        if (expand) {
            allPaths.forEach(p => this.expandedPaths.add(p));
        } else {
            this.expandedPaths.clear();
            this.pendingExpansionRequests.clear();
            this.pendingExpansionTimeouts.forEach(timeout => clearTimeout(timeout));
            this.pendingExpansionTimeouts.clear();
        }
        this.render(this.currentRoots, true);
    }

    private focusFirstChild(childrenContainer: HTMLElement): void {
        const firstChildHeader = childrenContainer.querySelector<HTMLElement>('.item-header');
        firstChildHeader?.focus();
    }

    private focusParentItem(item: HTMLElement): void {
        const parentChildren = item.parentElement;
        const parentItem = parentChildren?.closest('.file-tree-item') as HTMLElement | null;
        const parentHeader = parentItem?.querySelector<HTMLElement>(':scope > .item-header');
        parentHeader?.focus();
    }

    private focusRelativeHeader(currentItem: HTMLElement, offset: number): void {
        const headers = this.getVisibleHeaders();
        const currentHeader = currentItem.querySelector<HTMLElement>(':scope > .item-header');
        if (!currentHeader) { return; }

        const currentIndex = headers.indexOf(currentHeader);
        if (currentIndex < 0) { return; }

        const target = headers[currentIndex + offset];
        target?.focus();
    }

    private focusBoundaryHeader(boundary: 'first' | 'last'): void {
        const headers = this.getVisibleHeaders();
        const target = boundary === 'first' ? headers[0] : headers[headers.length - 1];
        target?.focus();
    }

    private getVisibleHeaders(): HTMLElement[] {
        return Array.from(this.container.querySelectorAll<HTMLElement>('.item-header'))
            .filter(header => this.isHeaderVisible(header));
    }

    private isHeaderVisible(header: HTMLElement): boolean {
        const item = header.closest('.file-tree-item') as HTMLElement | null;
        if (!item || item.style.display === 'none') {
            return false;
        }

        let current: HTMLElement | null = item;
        while (current && current !== this.container) {
            const parent = current.parentElement as HTMLElement | null;
            if (parent?.classList.contains('item-children')) {
                const parentItem = parent.parentElement as HTMLElement | null;
                if (parentItem && !parentItem.classList.contains('expanded')) {
                    return false;
                }
            }
            current = parent;
        }

        return true;
    }

    private showEmptyState(message: string): void {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = message;
        this.container.replaceChildren(emptyState);
    }

    private updateContainerBusyState(): void {
        const isBusy = this.filter.length > 0 && this.pendingExpansionRequests.size > 0;
        this.container.setAttribute('aria-busy', String(isBusy));
    }
}
