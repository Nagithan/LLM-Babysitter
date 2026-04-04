import * as assert from 'assert';
import * as vscode from 'vscode';

suite('LLM Babysitter Integration Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('nagithan.llm-babysitter'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('nagithan.llm-babysitter');
        if (extension) {
            await extension.activate();
            assert.strictEqual(extension.isActive, true);
        }
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const expectedCommands = [
            'llm-babysitter.refresh',
            'llm-babysitter.expandAll',
            'llm-babysitter.collapseAll',
            'llm-babysitter.blacklist'
        ];

        for (const cmd of expectedCommands) {
            assert.ok(commands.includes(cmd), `Command ${cmd} not found`);
        }
    });

    test('Configuration should be accessible', () => {
        const config = vscode.workspace.getConfiguration('llm-babysitter');
        assert.ok(config.has('excludePatterns'));
        const patterns = config.get<string[]>('excludePatterns');
        assert.ok(Array.isArray(patterns));
    });
});
