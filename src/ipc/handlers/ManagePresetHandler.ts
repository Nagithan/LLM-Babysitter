import * as vscode from 'vscode';
import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';
import { PresetManager } from '../../core/PresetManager.js';
import { Logger } from '../../core/Logger.js';
import { LocaleManager } from '../../i18n/LocaleManager.js';

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
            const { id, currentText } = message.payload;
            const presets = this.presetManager.getPresets();
            const preset = presets.find(p => p.id === id);
            
            if (!preset) {
                this.logger.error(`Preset manage failed: ID ${id} not found.`);
                return;
            }

            const isBuiltIn = id.startsWith('built-in-');
            if (isBuiltIn) {
                this.webview.sendStatus('error', LocaleManager.getTranslation('favorites.readOnly'));
                return;
            }

            const picks = [
                {
                    label: `$(save) ${LocaleManager.getTranslation('favorites.manage.update')}`,
                    value: 'update',
                    description: LocaleManager.getTranslation('favorites.manage.updateDescription')
                },
                {
                    label: `$(edit) ${LocaleManager.getTranslation('favorites.manage.rename')}`,
                    value: 'rename',
                    description: LocaleManager.getTranslation('favorites.manage.renameDescription')
                },
                {
                    label: `$(trash) ${LocaleManager.getTranslation('favorites.manage.delete')}`,
                    value: 'delete',
                    description: LocaleManager.getTranslation('favorites.manage.deleteDescription')
                }
            ];

            const result = await vscode.window.showQuickPick(picks, {
                placeHolder: `${LocaleManager.getTranslation('favorites.managePlaceholder')} ${preset.name}`
            });

            if (result?.value === 'rename') {
                const newName = await vscode.window.showInputBox({
                    prompt: LocaleManager.getTranslation('favorites.renamePrompt'),
                    value: preset.name
                });
                if (newName && newName !== preset.name) {
                    preset.name = newName;
                    await this.presetManager.savePreset(preset);
                    this.webview.sendStatus('success', LocaleManager.getTranslation('status.favoriteUpdated'));
                    await this.webview.sendInitialState();
                }
            } else if (result?.value === 'update') {
                if (!currentText.trim()) {
                    this.webview.sendStatus('error', LocaleManager.getTranslation('favorites.emptyContent'));
                    return;
                }
                preset.content = currentText;
                await this.presetManager.savePreset(preset);
                this.webview.sendStatus('success', LocaleManager.getTranslation('status.favoriteUpdated'));
                await this.webview.sendInitialState();
            } else if (result?.value === 'delete') {
                const deleteAction = LocaleManager.getTranslation('button.delete');
                const confirm = await vscode.window.showInformationMessage(
                    `${LocaleManager.getTranslation('favorites.deleteConfirm')} "${preset.name}"?`,
                    { modal: true },
                    deleteAction
                );
                if (confirm === deleteAction) {
                    await this.presetManager.deletePreset(id);
                    this.webview.sendStatus('success', LocaleManager.getTranslation('status.favoriteDeleted'));
                    await this.webview.sendInitialState();
                }
            }
        }
    }
}
