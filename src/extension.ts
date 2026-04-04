import * as vscode from 'vscode';
import { LLMBabysitterViewProvider } from './webview/LLMBabysitterViewProvider.js';
import { Logger } from './core/Logger.js';
import { BlacklistCommand } from './commands/BlacklistCommand.js';

/**
 * Extension Entry Point.
 * Optimized for minimal logic and maximum delegation to modular services.
 */
export function activate(context: vscode.ExtensionContext) {
    const logger = Logger.getInstance();
    logger.info('LLM Babysitter activated and ready to fly.');

    // Initialize the View Provider
    const provider = new LLMBabysitterViewProvider(context.extensionUri, context);

    // Register Webview View
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(LLMBabysitterViewProvider.viewType, provider)
    );

    /**
     * COMMAND REGISTRATION
     * Modular commands are registered via their specific Command classes.
     * Utility commands are registered directly for brevity.
     */
    BlacklistCommand.register(context, provider);

    context.subscriptions.push(
        vscode.commands.registerCommand('llm-babysitter.refresh', () => provider.refresh()),
        vscode.commands.registerCommand('llm-babysitter.expandAll', () => provider.expandAll()),
        vscode.commands.registerCommand('llm-babysitter.collapseAll', () => provider.collapseAll())
    );

    /**
     * OBSERVERS
     * React to configuration changes to keep the file tree in sync.
     */
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('llm-babysitter')) {
                provider.refresh();
            }
        })
    );
}

/**
 * Cleanup logic on extension deactivation.
 */
export function deactivate() {}
