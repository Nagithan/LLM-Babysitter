import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Backseat Pilot Integration Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('nagithan.backseat-pilot'));
	});

	test('Extension should activate', async () => {
		const extension = vscode.extensions.getExtension('nagithan.backseat-pilot');
		if (extension) {
			await extension.activate();
			assert.strictEqual(extension.isActive, true);
		}
	});

	test('Commands should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		const expectedCommands = [
			'backseat-pilot.refresh',
			'backseat-pilot.expandAll',
			'backseat-pilot.collapseAll',
			'backseat-pilot.blacklist'
		];

		for (const cmd of expectedCommands) {
			assert.ok(commands.includes(cmd), `Command ${cmd} not found`);
		}
	});

    test('Configuration should be accessible', () => {
        const config = vscode.workspace.getConfiguration('backseat-pilot');
        assert.ok(config.has('excludePatterns'));
        const patterns = config.get<string[]>('excludePatterns');
        assert.ok(Array.isArray(patterns));
    });
});
