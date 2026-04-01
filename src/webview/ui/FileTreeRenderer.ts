import { FileNode } from "../../types/index.js";
import { IpcClient } from "./IpcClient.js";
import { IpcMessageId } from "../../types/index.js";

export class FileTreeRenderer {
    private nodeDomMap: Map<string, HTMLElement> = new Map();
    private expandedPaths: Set<string> = new Set();
    private filter: string = '';

    constructor(
        private container: HTMLElement,
        private ipc: IpcClient,
        private selectedFiles: string[]
    ) {}

    public setSelection(selection: string[]): void {
        this.selectedFiles = selection;
        this.render();
    }

    public setFilter(filter: string): void {
        this.filter = filter.toLowerCase();
        this.render();
    }

    public render(roots: FileNode[] = []): void {
        if (roots.length > 0) {
            this.container.textContent = '';
            const fragment = document.createDocumentFragment();
            roots.forEach(root => this.renderNode(root, fragment, this.filter));
            this.container.appendChild(fragment);
        } else {
            // Full re-render if no roots provided (uses cached filter)
            // In a real reactive app, this would be more granular
        }
    }

    private renderNode(node: FileNode, parent: Node, filter: string): boolean {
        const selfMatches = node.name.toLowerCase().includes(filter);
        
        let item = this.nodeDomMap.get(node.relativePath);
        if (!item) {
            item = document.createElement('div');
            item.className = 'file-tree-item';
            this.nodeDomMap.set(node.relativePath, item);
        }

        // We use a separate header and children container
        let header = item.querySelector('.item-header') as HTMLElement;
        if (!header) {
            header = document.createElement('div');
            header.className = 'item-header';
            item.appendChild(header);
        }
        
        let childrenContainer = item.querySelector('.item-children') as HTMLElement;
        if (!childrenContainer) {
            childrenContainer = document.createElement('div');
            childrenContainer.className = 'item-children';
            item.appendChild(childrenContainer);
        }

        let anyChildMatches = false;
        if (node.children) {
            // To avoid innerHTML = '', we manage children precisely
            const currentChildPaths = new Set(node.children.map(c => c.relativePath));
            
            // Cleanup old children
            Array.from(childrenContainer.children).forEach(child => {
                const path = (child as any).dataset?.path;
                if (path && !currentChildPaths.has(path)) {
                    childrenContainer.removeChild(child);
                }
            });

            node.children.forEach(child => {
                if (this.renderNode(child, childrenContainer, filter)) {
                    anyChildMatches = true;
                }
            });
        }

        if (filter && !selfMatches && !anyChildMatches) {
            item.style.display = 'none';
            return false;
        } else {
            item.style.display = 'block';
        }

        header.textContent = ''; // Clear header for rebuild - safe since it's just text/icons
        (item as any).dataset.path = node.relativePath;

        if (this.expandedPaths.has(node.relativePath) || filter) {
            item.classList.add('expanded');
        } else {
            item.classList.remove('expanded');
        }

        // Chevron
        if (node.isDirectory) {
            const chevron = document.createElement('span');
            const isExpanded = item.classList.contains('expanded');
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

        if (parent !== item.parentElement) {
            parent.appendChild(item);
        }
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

    private handleToggle(node: FileNode, selected: boolean) {
        // Since the actual state is managed by StateManager/Extension, 
        // we just notify the host. In a real reactive app, this would be better.
        // For now, we reuse the existing recursive logic but encapsulated.
        let selection = [...this.selectedFiles];
        const toggleRecursive = (n: FileNode, s: boolean) => {
            if (s) {
                if (!selection.includes(n.relativePath)) {selection.push(n.relativePath);}
            } else {
                selection = selection.filter(p => p !== n.relativePath);
            }
            if (n.children) {n.children.forEach(c => toggleRecursive(c, s));}
        };
        toggleRecursive(node, selected);
        this.ipc.postMessage({ type: IpcMessageId.UPDATE_SELECTION, payload: selection });
    }

    private getNodeSelectionState(node: FileNode): { checked: boolean, indeterminate: boolean } {
        if (!node.isDirectory) {
            return { checked: this.selectedFiles.includes(node.relativePath), indeterminate: false };
        }
        if (!node.children || node.children.length === 0) {
            return { checked: this.selectedFiles.includes(node.relativePath), indeterminate: false };
        }
        let checkedCount = 0;
        let indeterminateCount = 0;
        node.children.forEach(child => {
            const state = this.getNodeSelectionState(child);
            if (state.checked) { checkedCount++; }
            if (state.indeterminate) { indeterminateCount++; }
        });
        if (checkedCount === node.children.length && checkedCount > 0) {
            return { checked: true, indeterminate: false };
        } else if (checkedCount > 0 || indeterminateCount > 0) {
            return { checked: false, indeterminate: true };
        } else {
            return { checked: this.selectedFiles.includes(node.relativePath), indeterminate: false };
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

    public handleExpandCollapseAll(expand: boolean, allPaths: string[]): void {
        if (expand) {
            allPaths.forEach(p => this.expandedPaths.add(p));
        } else {
            this.expandedPaths.clear();
        }
        this.render();
    }
}
