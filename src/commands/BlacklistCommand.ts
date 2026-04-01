import * as vscode from 'vscode';
import { Logger } from '../core/Logger.js';
import { BackseatPilotViewProvider } from '../webview/BackseatPilotViewProvider.js';

/**
 * Command Pattern Implementation for Blacklist functionality.
 * Extracts imperative logic from the extension entry point.
 */
export class BlacklistCommand {
    private static logger = Logger.getInstance();

    /**
     * Registers the command with VS Code.
     * @param context The extension context.
     * @param provider The webview provider (required for refreshing the file tree).
     */
    public static register(context: vscode.ExtensionContext, provider: BackseatPilotViewProvider): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('backseat-pilot.blacklist', async (uri: vscode.Uri) => {
                await this.execute(uri, provider);
            })
        );
    }

    /**
     * Executes the blacklist logic.
     * @param uri The URI of the file/folder to blacklist.
     * @param provider The webview provider instance.
     */
    private static async execute(uri: vscode.Uri, provider: BackseatPilotViewProvider): Promise<void> {
        if (!uri) {
            return;
        }

        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (!folder) {
            const msg = 'Blacklisting is only supported for files within an active workspace folder.';
            this.logger.error(`Blacklist failed: ${msg} Target: ${uri.fsPath}`);
            vscode.window.showWarningMessage(msg);
            return;
        }

        const config = vscode.workspace.getConfiguration('backseat-pilot');
        const excludes = config.get<string[]>('excludePatterns') || [];

        // Cross-platform reliability for relative path calculation
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        
        try {
            const stats = await vscode.workspace.fs.stat(uri);
            const isDirectory = stats.type === vscode.FileType.Directory;
            const pattern = isDirectory ? `**/${relativePath}/**` : `**/${relativePath}`;

            if (!excludes.includes(pattern)) {
                excludes.push(pattern);
                await config.update('excludePatterns', excludes, vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage(`Added to Backseat Pilot blacklist: ${relativePath}`);
                provider.refresh();
            }
        } catch (error: any) {
            this.logger.error(`Failed to stat URI ${uri.fsPath}: ${error.message}`);
            vscode.window.showErrorMessage(`Blacklist failed: Could not access file system.`);
        }
    }
}
