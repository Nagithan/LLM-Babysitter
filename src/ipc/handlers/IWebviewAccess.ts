import { ExtensionMessage } from '../../types/index.js';
import { AppState } from '../../types/index.js';

/**
 * Interface abstraction for the Webview Provider.
 * Allows IPC handlers to interact with the webview and extension state
 * without creating circular dependencies.
 */
export interface IWebviewAccess {
    /**
     * Refreshes the webview with the latest application state.
     */
    sendInitialState(): Promise<void>;

    /**
     * Persists the current file selection.
     */
    saveSelection(selection: string[]): void;

    /**
     * Sends a status notification (success/error) to the webview UI.
     */
    sendStatus(status: 'success' | 'error', message: string): void;

    /**
     * Persists the ID of the last selected preset for a specific section.
     */
    savePresetId(type: 'prePrompt' | 'postPrompt', id: string | null): void;

    /**
     * Tracks the latest text value for a prompt section so refreshes do not wipe user input.
     */
    saveText(type: keyof Pick<AppState, 'prePrompt' | 'instruction' | 'postPrompt'>, text: string): void;

    /**
     * Dispatches a raw message to the webview.
     */
    postMessage(message: ExtensionMessage): void;
}
