import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';

/**
 * Distinguished HTML Factory for the Backseat Pilot Webview.
 * Responsibility: Strict separation of UI structure from extension logic.
 * Adheres to CSP standards and URI management best practices.
 */
export class WebviewHtmlFactory {
    /**
     * Generates the complete HTML document for the Backseat Pilot view.
     * @param webview The target webview instance for URI resolution.
     * @param extensionUri The extension's base URI.
     */
    public static getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview-ui.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'ui', 'styles.css'));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'));

        const nonce = this.getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <link href="${codiconsUri}" rel="stylesheet">
                <link href="${styleUri}" rel="stylesheet">
                <title>Backseat Pilot</title>
            </head>
            <body>
                <div id="app">
                    <section class="form-section">
                        <div class="section-title-container">
                            <h3 id="label-prePrompt">Pre-prompt (Intro)</h3>
                            <button class="icon-btn" id="help-prePrompt" title="Set the persona, background context, or overall goal for the AI (e.g., 'Act as a Senior Python Expert').">
                                <span class="codicon codicon-question"></span>
                            </button>
                        </div>
                        <div class="header-with-actions">
                            <div class="favorites-list" id="favorites-prePrompt"></div>
                            <div class="favorite-actions">
                                <button class="icon-btn" id="save-prePrompt" title="Save as Favorite">
                                    <span class="codicon codicon-heart"></span>
                                </button>
                                <button class="icon-btn" id="manage-prePrompt" title="Manage Favorite">
                                    <span class="codicon codicon-ellipsis"></span>
                                </button>
                            </div>
                        </div>
                        <div class="input-container">
                            <textarea class="main-textarea" id="prePrompt" placeholder="..."></textarea>
                        </div>
                    </section>

                    <section class="form-section">
                        <div class="section-title-container">
                            <h3 id="label-instruction">Main Instruction</h3>
                            <button class="icon-btn" id="help-instruction" title="Provide the specific task or question you want the AI to execute using the selected workspace files.">
                                <span class="codicon codicon-question"></span>
                            </button>
                        </div>
                        <div class="header-with-actions">
                            <div class="favorites-list" id="favorites-instruction"></div>
                            <div class="favorite-actions">
                                <button class="icon-btn" id="save-instruction" title="Save as Favorite">
                                    <span class="codicon codicon-heart"></span>
                                </button>
                                <button class="icon-btn" id="manage-instruction" title="Manage Favorite">
                                    <span class="codicon codicon-ellipsis"></span>
                                </button>
                            </div>
                        </div>
                        <div class="input-container">
                            <textarea class="main-textarea" id="instruction" placeholder="..."></textarea>
                        </div>
                    </section>

                    <section class="form-section">
                        <div class="section-header">
                            <div class="section-title-container">
                                <h3 id="label-files">Workspace Files</h3>
                                <button class="icon-btn" id="help-files" title="Select the exact files to inject into the LLM context. Keep selections targeted to avoid exceeding token limits.">
                                    <span class="codicon codicon-question"></span>
                                </button>
                            </div>
                            <div class="header-actions">
                                <button class="icon-btn" id="selectAll" title="Select All">
                                    <span class="codicon codicon-check-all"></span>
                                </button>
                                <button class="icon-btn" id="deselectAll" title="Deselect All">
                                    <span class="codicon codicon-clear-all"></span>
                                </button>
                            </div>
                        </div>
                        <div class="search-container">
                            <input type="text" id="fileSearch" class="main-input" placeholder="Search files...">
                        </div>
                        <div id="file-tree" class="file-tree"></div>
                    </section>

                    <section class="form-section">
                        <div class="section-title-container">
                            <h3 id="label-postPrompt">Post-prompt (Conclusion)</h3>
                            <button class="icon-btn" id="help-postPrompt" title="Add concluding rules, output format constraints, or specific formatting requirements (e.g., 'Output only valid JSON').">
                                <span class="codicon codicon-question"></span>
                            </button>
                        </div>
                        <div class="header-with-actions">
                            <div class="favorites-list" id="favorites-postPrompt"></div>
                            <div class="favorite-actions">
                                <button class="icon-btn" id="save-postPrompt" title="Save as Favorite">
                                    <span class="codicon codicon-heart"></span>
                                </button>
                                <button class="icon-btn" id="manage-postPrompt" title="Manage Favorite">
                                    <span class="codicon codicon-ellipsis"></span>
                                </button>
                            </div>
                        </div>
                        <div class="input-container">
                            <textarea class="main-textarea" id="postPrompt" placeholder="..."></textarea>
                        </div>
                    </section>



                    <div class="main-actions">
                        <div class="token-container" id="token-container">
                            <div class="token-info">
                                <span class="token-label">Token Usage</span>
                                <span class="token-value"><span id="token-count">0</span> / 128k</span>
                            </div>
                            <div class="progress-bar-bg">
                                <div id="token-bar-prompts" class="progress-bar-fill prompts" style="width: 0%"></div>
                                <div id="token-bar-files" class="progress-bar-fill files" style="width: 0%"></div>
                            </div>
                            <div id="token-breakdown" class="token-breakdown">
                                <div class="breakdown-item">
                                    <span class="dot prompts"></span>
                                    <span class="breakdown-label">Prompts:</span>
                                    <span id="count-prompts" class="breakdown-value">0</span>
                                </div>
                                <div class="breakdown-item">
                                    <span class="dot files"></span>
                                    <span class="breakdown-label">Files:</span>
                                    <span id="count-files" class="breakdown-value">0</span>
                                </div>
                            </div>
                        </div>
                        <button id="copy-clipboard" class="primary-btn">
                            <span class="codicon codicon-copy"></span>
                            Copy to Clipboard
                        </button>
                    </div>
                    
                    <div id="status-bar" class="status-bar"></div>
                </div>

                <div id="favorite-modal" class="overlay">
                    <div class="modal">
                        <h3 id="modal-title">Name your favorite</h3>
                        <input type="text" id="favorite-name" class="main-input" placeholder="Favorite name...">
                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button id="cancel-favorite" class="secondary-btn">Cancel</button>
                            <button id="confirm-favorite" class="primary-btn-small">Save</button>
                        </div>
                    </div>
                </div>

                <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    /**
     * Generates a secure random nonce for script execution.
     */
    private static getNonce(): string {
        return randomBytes(16).toString('base64');
    }
}
