import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { MockWorkspace } from '../../mocks/vscode.js';
import { FileManager } from '../../../core/FileManager.js';
import { TestUtils } from '../../testUtils.js';

/**
 * Unit Tests for FileManager.
 * These tests run within the Vitest environment with mocked VS Code API.
 */
describe('FileManager Unit Tests', () => {

    beforeEach(async () => {
        await TestUtils.fullReset();
        TestUtils.setupWorkspaceFolders([{ name: 'Project', path: '/workspaces/project' }]);
    });

    describe('resolveDisplayPath', () => {
        it('should resolve a valid display path within the workspace', () => {
            const uri = FileManager.resolveDisplayPath('Project/src/main.ts');
            expect(uri.fsPath).toBe('/workspaces/project/src/main.ts');
        });

        it('should throw Security Error for path traversal via ".."', () => {
            expect(() => {
                FileManager.resolveDisplayPath('Project/../../etc/passwd');
            }).toThrow(/Security Error/);
        });

        it('should throw if workspace folder is not found', () => {
            expect(() => {
                FileManager.resolveDisplayPath('Unknown/file.txt');
            }).toThrow(/Workspace folder "Unknown" not found/);
        });
    });

    describe('getRoots', () => {
        it('should return an array of root nodes based on workspace folders', async () => {
            const roots = await FileManager.getRoots();
            expect(Array.isArray(roots)).toBe(true);
            expect(roots.length).toBe(1);
            expect(roots[0].name).toBe('Project');
            expect(roots[0].isDirectory).toBe(true);
        });

        it('should return empty array if no workspace folders', async () => {
            TestUtils.clearWorkspaceFolders();
            const roots = await FileManager.getRoots();
            expect(roots).toEqual([]);
        });
    });

    describe('getFolderChildren', () => {
        it('should list children of a folder and sort them (directories first)', async () => {
            const ws = vscode.workspace as unknown as MockWorkspace;
            ws.setMockFile('/workspaces/project/src/file.ts', 'content');
            ws.setMockFile('/workspaces/project/src/subdir/placeholder', '');
            ws.setMockFile('/workspaces/project/src/another_file.ts', 'content');

            const children = await FileManager.getFolderChildren('Project/src');
            
            expect(children.length).toBe(3);
            expect(children[0].name).toBe('subdir');
            expect(children[0].isDirectory).toBe(true);
            expect(children[0].children).toBeUndefined(); // Verify fix
            expect(children[1].name).toBe('another_file.ts');
            expect(children[2].name).toBe('file.ts');
        });

        it('should keep useful dotfiles while hiding internal VCS/system entries', async () => {
            const ws = vscode.workspace as unknown as MockWorkspace;
            ws.setMockFile('/workspaces/project/src/.git/config', '');
            ws.setMockFile('/workspaces/project/src/.github/workflow.yml', '');
            ws.setMockFile('/workspaces/project/src/.vscode/settings.json', '');
            ws.setMockFile('/workspaces/project/src/.env', '');
            ws.setMockFile('/workspaces/project/src/.editorconfig', '');
            ws.setMockFile('/workspaces/project/src/visible.ts', '');

            const children = await FileManager.getFolderChildren('Project/src');
            const names = children.map(c => c.name);
            
            expect(names).toContain('.github');
            expect(names).toContain('.vscode');
            expect(names).toContain('.env');
            expect(names).toContain('.editorconfig');
            expect(names).toContain('visible.ts');
            expect(names).not.toContain('.git');
        });

        it('should hide symbolic links from folder listings', async () => {
            vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
                ['safe.ts', vscode.FileType.File],
                ['docs', vscode.FileType.Directory],
                ['linked.pem', vscode.FileType.File | vscode.FileType.SymbolicLink],
                ['linked-dir', vscode.FileType.Directory | vscode.FileType.SymbolicLink],
            ]);

            const children = await FileManager.getFolderChildren('Project/src');
            const names = children.map(c => c.name);

            expect(names).toContain('safe.ts');
            expect(names).toContain('docs');
            expect(names).not.toContain('linked.pem');
            expect(names).not.toContain('linked-dir');
        });

        it('should deduplicate concurrent scans for the same path', async () => {
            let callCount = 0;
            const ws = vscode.workspace as unknown as MockWorkspace;
            const fsImpl = ws.getFsImpl();
            // Need a file to exist so readDirectory doesn't fail
            ws.setMockFile('/workspaces/project/concurrent/placeholder', '');

            vi.mocked(vscode.workspace.fs.readDirectory).mockImplementation(async (uri) => {
                callCount++;
                await new Promise(r => setTimeout(r, 10));
                return fsImpl.readDirectory(uri);
            });

            // Fire multiple concurrent scans
            const p1 = FileManager.getFolderChildren('Project/concurrent');
            const p2 = FileManager.getFolderChildren('Project/concurrent');
            
            await Promise.all([p1, p2]);
            
            expect(callCount).toBe(1);
        });
    });

    describe('getFileContent', () => {
        it('should return file content for a valid text file', async () => {
            (vscode.workspace as unknown as MockWorkspace).setMockFile('/workspaces/project/src/hello.ts', 'Hello World');

            const content = await FileManager.getFileContent('Project/src/hello.ts');
            expect(content).toEqual({ kind: 'content', content: 'Hello World' });
        });

        it('should skip directories', async () => {
            const ws = vscode.workspace as unknown as MockWorkspace;
            ws.setMockFile('/workspaces/project/src/dir/file', ''); // Creates a directory 'dir'

            const content = await FileManager.getFileContent('Project/src/dir');
            expect(content.kind).toBe('directory');
            expect(content.content).toContain('skipped');
            expect(content.content).toContain('directory');
        });

        it('should skip symbolic links for security', async () => {
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({
                type: vscode.FileType.File | vscode.FileType.SymbolicLink,
                size: 42,
                ctime: 0,
                mtime: 0
            });

            const content = await FileManager.getFileContent('Project/src/linked.pem');
            expect(content.kind).toBe('symlink');
            expect(content.content).toContain('skipped for security');
            expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
        });

        it('should skip large files', async () => {
            // Manually override stat for this specific case
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({ 
                type: vscode.FileType.File, 
                size: 10 * 1024 * 1024,
                ctime: 0,
                mtime: 0 
            });

            const content = await FileManager.getFileContent('Project/src/huge.ts');
            expect(content.kind).toBe('tooLarge');
            expect(content.content).toContain('too large');
        });

        it('should skip binary files', async () => {
            (vscode.workspace as unknown as MockWorkspace).setMockFile('/workspaces/project/src/image.png', new Uint8Array([0x00, 0x01]));

            const content = await FileManager.getFileContent('Project/src/image.png');
            expect(content.kind).toBe('binary');
            expect(content.content).toContain('Binary file');
        });

        it('should handle filesystem errors gracefully', async () => {
            vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('Device error'));
            
            const content = await FileManager.getFileContent('Project/src/fail.ts');
            expect(content.kind).toBe('error');
            expect(content.content).toContain('Error reading file');
            expect(content.content).toContain('Device error');
        });
    });

    describe('Security Boundaries (Edge Cases)', () => {
        it('should throw if no workspace folders are open', () => {
            TestUtils.clearWorkspaceFolders();
            expect(() => FileManager.resolveDisplayPath('Project/file.ts')).toThrow('No workspace folders');
        });

        it('should throw if folder name prefix is incorrect', () => {
             TestUtils.setupWorkspaceFolders([{ name: 'Real', path: '/real' }]);
             expect(() => FileManager.resolveDisplayPath('Fake/file.ts')).toThrow('folder "Fake" not found');
        });

        it('should throw if path escapes via encoded/relative URI tricks', () => {
            // Mock joinPath to return something outside
            vi.spyOn(vscode.Uri, 'joinPath').mockReturnValue(vscode.Uri.file('/etc/passwd'));
            
            expect(() => FileManager.resolveDisplayPath('Project/../../../etc/passwd')).toThrow('outside of the workspace folder');
        });
    });

    describe('getFolderChildren (Exclusion Patterns)', () => {
        it('should exclude files matching user-defined patterns', async () => {
            const ws = vscode.workspace as unknown as MockWorkspace;
            ws.setMockFile('/workspaces/project/src/include.ts', '');
            ws.setMockFile('/workspaces/project/src/exclude.ts', '');
            
            // Mock configuration
            const mockConfig = {
                get: vi.fn().mockImplementation((key: string) => {
                    if (key === 'excludePatterns') {return ['exclude.ts'];}
                    return [];
                })
            };
            vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as unknown as vscode.WorkspaceConfiguration);

            const children = await FileManager.getFolderChildren('Project/src');
            const names = children.map(c => c.name);
            
            expect(names).toContain('include.ts');
            expect(names).not.toContain('exclude.ts');
        });
    });

    describe('getFileContent (Error Ternary)', () => {
        it('should handle non-Error objects in catch block', async () => {
            // Mock stat to succeed so we reach the catch block in readFile
            vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({ 
                type: vscode.FileType.File, 
                size: 100,
                ctime: 0,
                mtime: 0 
            });
            // Mock readFile to throw a string instead of Error
            vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue('Not an Error object');
            
            const content = await FileManager.getFileContent('Project/src/file.ts');
            expect(content).toEqual({
                kind: 'error',
                content: '[Error reading file: Not an Error object]'
            });
        });
    });
});
