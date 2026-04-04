/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileTreeRenderer } from '../../../webview/ui/FileTreeRenderer.js';
import { FileNode, IpcMessageId } from '../../../types/index.js';

describe('FileTreeRenderer Webview Unit Tests', () => {
    let container: HTMLElement;
    let mockIpc: any;
    let renderer: FileTreeRenderer;

    beforeEach(() => {
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container); // Append to body for better event simulation
        mockIpc = {
            postMessage: vi.fn(),
            setState: vi.fn(),
            getState: vi.fn()
        };
        renderer = new FileTreeRenderer(container, mockIpc, []);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    it('should render a simple file tree with correct hierarchy', () => {
        const roots: FileNode[] = [
            { name: 'src', relativePath: 'src', isDirectory: true, children: [
                { name: 'main.ts', relativePath: 'src/main.ts', isDirectory: false }
            ]}
        ];

        renderer.render(roots);

        const items = container.querySelectorAll('.file-tree-item');
        expect(items.length).toBe(2);
        
        const folder = items[0];
        const file = items[1];
        
        expect(folder.textContent).toContain('src');
        expect(folder.querySelector('.codicon-chevron-right')).not.toBeNull();
        
        expect(file.textContent).toContain('main.ts');
        expect(folder.contains(file)).toBe(true); // Verifies hierarchy
    });

    it('should toggle selection when clicking the label (not just checkbox)', async () => {
        const roots: FileNode[] = [
            { name: 'file.ts', relativePath: 'file.ts', isDirectory: false }
        ];

        renderer.render(roots);
        const label = container.querySelector('.item-label') as HTMLElement;
        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

        label.click();

        expect(checkbox.checked).toBe(true);
        await vi.waitFor(() => {
            expect(mockIpc.postMessage).toHaveBeenCalledWith(expect.objectContaining({
                type: IpcMessageId.UPDATE_SELECTION,
                payload: ['file.ts']
            }));
        });
    });

    it('should handle node expansion and trigger IPC', () => {
        const roots: FileNode[] = [
            { name: 'folder', relativePath: 'folder', isDirectory: true, children: [] }
        ];

        renderer.render(roots);
        const item = container.querySelector('.file-tree-item') as HTMLElement;
        const chevron = item.querySelector('.codicon-chevron-right') as HTMLElement;

        chevron.click();

        expect(item.classList.contains('expanded')).toBe(true);
        expect(mockIpc.postMessage).toHaveBeenCalledWith({
            type: IpcMessageId.EXPAND_FOLDER,
            payload: 'folder'
        });
    });

    it('should filter nodes and highlight matches', () => {
        const roots: FileNode[] = [
            { name: 'match.ts', relativePath: 'match.ts', isDirectory: false },
            { name: 'other.ts', relativePath: 'other.ts', isDirectory: false }
        ];

        renderer.render(roots);
        renderer.setFilter('match');

        const items = Array.from(container.querySelectorAll('.file-tree-item')) as HTMLElement[];
        const visibleItems = items.filter(i => i.style.display !== 'none');
        
        expect(visibleItems.length).toBe(1);
        expect(visibleItems[0].textContent).toContain('match.ts');
        
        const highlight = visibleItems[0].querySelector('.highlight');
        expect(highlight?.textContent).toBe('match');
    });

    it('should handle recursive folder selection and de-selection', async () => {
        const roots: FileNode[] = [
            { name: 'src', relativePath: 'src', isDirectory: true, children: [
                { name: 'a.ts', relativePath: 'src/a.ts', isDirectory: false },
                { name: 'b.ts', relativePath: 'src/b.ts', isDirectory: false }
            ]}
        ];

        renderer.render(roots);
        const folderCheckbox = container.querySelector('.file-tree-item input[type="checkbox"]') as HTMLInputElement;

        // Select All
        folderCheckbox.checked = true;
        folderCheckbox.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(mockIpc.postMessage).toHaveBeenCalledWith(expect.objectContaining({
                payload: ['src/a.ts', 'src/b.ts']
            }));
        });

        // De-select All
        folderCheckbox.checked = false;
        folderCheckbox.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
            expect(mockIpc.postMessage).toHaveBeenCalledWith(expect.objectContaining({
                payload: []
            }));
        });
    });

    it('should show indeterminate state correctly', () => {
        const roots: FileNode[] = [
            { name: 'src', relativePath: 'src', isDirectory: true, children: [
                { name: 'a.ts', relativePath: 'src/a.ts', isDirectory: false },
                { name: 'b.ts', relativePath: 'src/b.ts', isDirectory: false }
            ]}
        ];

        renderer = new FileTreeRenderer(container, mockIpc, ['src/a.ts']);
        renderer.render(roots);

        const folderCheckbox = container.querySelector('.file-tree-item input[type="checkbox"]') as HTMLInputElement;
        expect(folderCheckbox.checked).toBe(false);
        expect(folderCheckbox.indeterminate).toBe(true);
    });

    it('should handle async folder expansion with lazy-loaded children', async () => {
        const roots: FileNode[] = [
            { name: 'folder', relativePath: 'folder', isDirectory: true, children: [] }
        ];

        renderer.render(roots);
        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

        checkbox.checked = true; // Select empty folder
        checkbox.dispatchEvent(new Event('change'));

        // Should post EXPAND_FOLDER
        expect(mockIpc.postMessage).toHaveBeenCalledWith({ 
            type: IpcMessageId.EXPAND_FOLDER, 
            payload: 'folder' 
        });

        // Simulate lazy-load arrival
        window.postMessage({
            type: 'folderChildren',
            payload: {
                parentPath: 'folder',
                children: [{ name: 'child.ts', relativePath: 'folder/child.ts', isDirectory: false }]
            }
        }, '*');

        // Should now select the arrived child
        await vi.waitFor(() => {
            expect(mockIpc.postMessage).toHaveBeenCalledWith(expect.objectContaining({
                type: IpcMessageId.UPDATE_SELECTION,
                payload: ['folder/child.ts']
            }));
        });
    });

    it('should use correct icons for file extensions', () => {
        const roots: FileNode[] = [
            { name: 'test.ts', relativePath: 'test.ts', isDirectory: false },
            { name: 'data.json', relativePath: 'data.json', isDirectory: false }
        ];

        renderer.render(roots);

        const tsIcon = container.querySelector('.codicon-code') as HTMLElement;
        const jsonIcon = container.querySelector('.codicon-json') as HTMLElement;
        
        expect(tsIcon).not.toBeNull();
        expect(jsonIcon).not.toBeNull();
        
        // Colors are applied via styles
        expect(tsIcon.style.color).toBeTruthy();
        expect(jsonIcon.style.color).toBeTruthy();
    });

    it('should handle expand/collapse all signals', () => {
        const roots: FileNode[] = [
            { name: 'f1', relativePath: 'f1', isDirectory: true, children: [] },
            { name: 'f2', relativePath: 'f2', isDirectory: true, children: [] }
        ];

        renderer.render(roots);
        
        renderer.handleExpandCollapseAll(true, ['f1', 'f2']);
        expect(container.querySelectorAll('.file-tree-item.expanded').length).toBe(2);

        renderer.handleExpandCollapseAll(false, []);
        expect(container.querySelectorAll('.file-tree-item.expanded').length).toBe(0);
    });

    it('should render empty state when no roots are provided', () => {
        renderer.render([]);
        expect(container.textContent).toContain('No files found.');
    });
});
