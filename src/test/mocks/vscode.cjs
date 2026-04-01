/**
 * Lightweight mock of the VS Code API for pure Node.js unit tests.
 * This avoids the dependency on Electron/VSCode-Test for non-UI logic.
 */
const vscode = {
    workspace: {
        workspaceFolders: [],
        fs: {
            stat: () => Promise.resolve({ type: 1, size: 0 }),
            readFile: () => Promise.resolve(Buffer.from(''))
        },
        getConfiguration: () => ({
            get: (key) => []
        })
    },
    Uri: {
        file: (path) => ({ fsPath: path, path }),
        joinPath: (uri, ...parts) => ({ fsPath: uri.fsPath + '/' + parts.join('/'), path: uri.path + '/' + parts.join('/') }),
    },
    FileType: {
        File: 1,
        Directory: 2,
        SymbolicLink: 64,
        Unknown: 0
    },
    window: {
        showInformationMessage: () => Promise.resolve(),
        showErrorMessage: () => Promise.resolve()
    }
};

module.exports = vscode;
