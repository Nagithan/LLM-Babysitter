import * as vscode from 'vscode';
import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';
import { PresetManager } from '../../core/PresetManager.js';
import { Logger } from '../../core/Logger.js';

/**
 * Complex template management handler.
 * Provides interactive QuickPick and InputBox UI for renaming, updating, and deleting presets.
 */
export class ManagePresetHandler implements IIpcMessageHandler {
    private logger = Logger.getInstance();

    constructor(
        private webview: IWebviewAccess, 
        private presetManager: PresetManager
    ) {}

    async execute(message: WebviewMessage) {
        if (message.type === IpcMessageId.MANAGE_PRESET) {
            const { id, type, currentText } = message.payload;
            const presets = this.presetManager.getPresets();
            const preset = presets.find(p => p.id === id);
            
            if (!preset) {
                this.logger.error(`Preset manage failed: ID ${id} not found.`);
                return;
            }

            const isBuiltIn = id.startsWith('built-in-');
            if (isBuiltIn) {
                this.webview.sendStatus('error', 'Built-in templates cannot be modified directly.');
                return;
            }

            const picks = [
                { label: '$(save) Update with current text', value: 'update', description: 'Overwrite favorite content' },
                { label: '$(edit) Rename', value: 'rename', description: 'Change name of favorite' },
                { label: '$(trash) Delete', value: 'delete', description: 'Remove favorite permanently' }
            ];

            const result = await vscode.window.showQuickPick(picks, {
                placeHolder: `Manage Favorite: ${preset.name}`
            });

            if (result?.value === 'rename') {
                const newName = await vscode.window.showInputBox({
                    prompt: 'Enter new name for the favorite',
                    value: preset.name
                });
                if (newName && newName !== preset.name) {
                    preset.name = newName;
                    await this.presetManager.savePreset(preset);
                    await this.webview.sendInitialState();
                }
            } else if (result?.value === 'update') {
                if (!currentText.trim()) {
                    this.webview.sendStatus('error', 'Cannot save empty content.');
                    return;
                }
                preset.content = currentText;
                await this.presetManager.savePreset(preset);
                this.webview.sendStatus('success', `"${preset.name}" updated successfully.`);
                await this.webview.sendInitialState();
            } else if (result?.value === 'delete') {
                const confirm = await vscode.window.showInformationMessage(
                    `Are you sure you want to delete "${preset.name}"?`,
                    { modal: true },
                    'Delete'
                );
                if (confirm === 'Delete') {
                    await this.presetManager.deletePreset(id);
                    await this.webview.sendInitialState();
                }
            }
        }
    }
}
