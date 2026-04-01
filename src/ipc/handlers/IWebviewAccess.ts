
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
     * Dispatches a raw message to the webview.
     */
    postMessage(message: any): void;
}
