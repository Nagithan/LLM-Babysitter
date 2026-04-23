import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';
import { PresetManager } from '../../core/PresetManager.js';
import { Logger } from '../../core/Logger.js';
import { LocaleManager } from '../../i18n/LocaleManager.js';

/**
 * Handler for template removal.
 */
export class DeletePresetHandler implements IIpcMessageHandler {
    private logger = Logger.getInstance();
    
    constructor(
        private webview: IWebviewAccess, 
        private presetManager: PresetManager
    ) {}

    async execute(message: WebviewMessage) {
        if (message.type === IpcMessageId.DELETE_PRESET) {
            await this.presetManager.deletePreset(message.payload);
            this.logger.info(`Preset deleted: ${message.payload}`);
            this.webview.sendStatus('success', LocaleManager.getTranslation('status.favoriteDeleted'));
            await this.webview.sendInitialState();
        }
    }
}
