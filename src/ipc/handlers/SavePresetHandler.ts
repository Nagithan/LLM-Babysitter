import { WebviewMessage, IpcMessageId } from '../../types/index.js';
import { IIpcMessageHandler } from './IpcHandler.js';
import { IWebviewAccess } from './IWebviewAccess.js';
import { PresetManager } from '../../core/PresetManager.js';
import { Logger } from '../../core/Logger.js';
import { LocaleManager } from '../../i18n/LocaleManager.js';

/**
 * Handler for saving templates and favorites.
 */
export class SavePresetHandler implements IIpcMessageHandler {
    private logger = Logger.getInstance();
    
    constructor(
        private webview: IWebviewAccess, 
        private presetManager: PresetManager
    ) {}

    async execute(message: WebviewMessage) {
        if (message.type === IpcMessageId.SAVE_PRESET) {
            await this.presetManager.savePreset(message.payload);
            this.logger.info(`Preset saved: ${message.payload.name}`);
            this.webview.sendStatus('success', LocaleManager.getTranslation('status.favoriteSaved'));
            await this.webview.sendInitialState();
        }
    }
}
