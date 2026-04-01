import * as assert from 'assert';
import * as vscode from 'vscode';
import { FileManager } from '../core/FileManager.js';

/**
 * Integration & Logic Tests for FileManager.
 * These tests run within the VS Code Extension Host.
 */
suite('FileManager Test Suite', () => {

    test('isBinary() - Text Detection', () => {
        // Accessing private method for unit testing logic
        const fm = FileManager as any;
        const textBuffer = Buffer.from('Hello, World!\nThis is a text file.');
        assert.strictEqual(fm.isBinary(textBuffer), false, 'Normal text should not be binary');
    });

    test('isBinary() - Binary Detection', () => {
        const fm = FileManager as any;
        const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF]);
        assert.strictEqual(fm.isBinary(binaryBuffer), true, 'Buffers with null bytes should be binary');
    });

    test('resolveDisplayPath() - Security boundary check', () => {
        const fm = FileManager as any;
        
        // This should throw because it attempts traversal
        assert.throws(() => {
            fm.resolveDisplayPath('Project/../../etc/passwd');
        }, /Security Error/, 'Should prevent path traversal via ".."');
    });

    test('getRoots() - Basic return check', async () => {
        const roots = await FileManager.getRoots();
        assert.ok(Array.isArray(roots), 'getRoots should return an array');
        // If a workspace is open during tests, roots should not be empty
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            assert.ok(roots.length > 0, 'Should have at least one root folder');
        }
    });
});
