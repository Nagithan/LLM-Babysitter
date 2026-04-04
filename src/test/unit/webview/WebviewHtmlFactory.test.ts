import { describe, it, expect, vi } from 'vitest';
import { WebviewHtmlFactory } from '../../../webview/WebviewHtmlFactory.js';
import * as vscode from 'vscode';

vi.mock('node:crypto', () => ({
    randomBytes: vi.fn().mockReturnValue(Buffer.from('deadbeefdeadbeefdeadbeefdeadbeef', 'hex'))
}));

describe('WebviewHtmlFactory', () => {
    it('should generate HTML with correct nonce and URIs', () => {
        const mockWebview = {
            asWebviewUri: vi.fn((uri: { toString: () => string }) => uri.toString()),
            cspSource: 'vscode-resource:'
        } as unknown as vscode.Webview;
        const mockExtensionUri = {
            fsPath: '/mock/path',
            scheme: 'file',
            authority: '',
            path: '/mock/path',
            query: '',
            fragment: '',
            with: vi.fn(),
            toJSON: vi.fn(),
            toString: () => 'file:///mock/path'
        } as unknown as vscode.Uri;

        // Mock vscode module if needed, but here we pass mocks directly
        const html = WebviewHtmlFactory.getHtml(mockWebview, mockExtensionUri);

        // Nonce for deadbeef in base64 is '3q2+796u796u796u796u7w=='
        const expectedNonce = Buffer.from('deadbeefdeadbeefdeadbeefdeadbeef', 'hex').toString('base64');
        
        expect(html).toContain(`nonce="${expectedNonce}"`);
        expect(html).toContain(`script-src 'nonce-${expectedNonce}'`);
        expect(html).toContain('webview-ui.js');
        expect(html).toContain('LLM Babysitter');
        expect(html).toContain('id="app"');
    });
});
