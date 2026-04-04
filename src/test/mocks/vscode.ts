import { vi, Mock } from 'vitest';

/**
 * Robust mock for the VS Code API.
 * Uses vitest mocks to allow tracking calls and overriding behavior in tests.
 */

export const Event = vi.fn();

export enum UIKind {
    Desktop = 1,
    Web = 2
}

export enum StatusBarAlignment {
    Left = 1,
    Right = 2
}

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3
}

interface MockFsEntry {
    type: FileType;
    content?: Uint8Array;
}

export class Uri {
    static file(path: string) {
        return new Uri('file', '', path, '', '');
    }
    static parse(value: string) {
        const url = new URL(value);
        return new Uri(url.protocol.slice(0, -1), url.host, url.pathname, url.search, url.hash);
    }
    static joinPath(base: Uri, ...pathSegments: string[]) {
        const fullPath = base.fsPath + (base.fsPath.endsWith('/') ? '' : '/') + pathSegments.join('/');
        const parts = fullPath.split('/');
        const stack: string[] = [];
        for (const part of parts) {
            if (part === '..') {
                stack.pop();
            } else if (part !== '.' && part !== '') {
                stack.push(part);
            }
        }
        const normalizedPath = (fullPath.startsWith('/') ? '/' : '') + stack.join('/');
        return Uri.file(normalizedPath);
    }

    constructor(
        public readonly scheme: string,
        public readonly authority: string,
        public readonly path: string,
        public readonly query: string,
        public readonly fragment: string
    ) {}

    get fsPath() { return this.path; }
    toString() { return `${this.scheme}://${this.authority}${this.path}`; }
    toJSON() { return { scheme: this.scheme, authority: this.authority, path: this.path, query: this.query, fragment: this.fragment }; }
}

const mockFs = new Map<string, MockFsEntry>();

// Internal implementations to avoid recursion during spying
const fsImpl = {
    stat: async (uri: Uri) => {
        const entry = mockFs.get(uri.fsPath);
        if (entry) {
            return { type: entry.type, size: entry.content?.length || 0, ctime: 0, mtime: 0 };
        }
        // Directory discovery: if any entry starts with this path + '/', it's a directory
        const prefix = uri.fsPath.endsWith('/') ? uri.fsPath : uri.fsPath + '/';
        for (const path of mockFs.keys()) {
            if (path.startsWith(prefix)) {
                return { type: FileType.Directory, size: 0, ctime: 0, mtime: 0 };
            }
        }
        throw new Error(`File not found: ${uri.fsPath}`);
    },
    readFile: async (uri: Uri) => {
        const entry = mockFs.get(uri.fsPath);
        if (!entry || !entry.content) { throw new Error(`File not found or is a directory: ${uri.fsPath}`); }
        return entry.content;
    },
    readDirectory: async (uri: Uri) => {
        const results: [string, FileType][] = [];
        const prefix = uri.fsPath.endsWith('/') ? uri.fsPath : uri.fsPath + '/';
        for (const [path, entry] of mockFs.entries()) {
            if (path.startsWith(prefix)) {
                const relative = path.slice(prefix.length);
                const name = relative.split('/')[0];
                if (name && !results.some(r => r[0] === name)) {
                    const isSubDir = relative.includes('/');
                    results.push([name, isSubDir ? FileType.Directory : entry.type]);
                }
            }
        }
        // Also check for virtual directories (parents of files)
        if (results.length === 0) {
             // Check if it's a known directory via discovery
             try { await fsImpl.stat(uri); } catch { throw new Error(`Directory not found: ${uri.fsPath}`); }
        }
        return results;
    },
    writeFile: async (uri: Uri, content: Uint8Array) => {
        mockFs.set(uri.fsPath, { type: FileType.File, content });
    },
    createDirectory: async (uri: Uri) => {
        mockFs.set(uri.fsPath, { type: FileType.Directory });
    },
    delete: async (uri: Uri) => {
        mockFs.delete(uri.fsPath);
    }
};

export const workspace = {
    workspaceFolders: [] as any[],
    getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string) => undefined),
        update: vi.fn(),
        has: vi.fn(),
        inspect: vi.fn(),
    })),
    fs: {
        stat: vi.fn().mockImplementation(fsImpl.stat),
        readFile: vi.fn().mockImplementation(fsImpl.readFile),
        readDirectory: vi.fn().mockImplementation(fsImpl.readDirectory),
        writeFile: vi.fn().mockImplementation(fsImpl.writeFile),
        delete: vi.fn().mockImplementation(fsImpl.delete),
        rename: vi.fn(),
        copy: vi.fn(),
        createDirectory: vi.fn().mockImplementation(fsImpl.createDirectory),
    },
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    getWorkspaceFolder: vi.fn((uri: Uri) => {
        return workspace.workspaceFolders.find(f => uri.fsPath.startsWith(f.uri.fsPath));
    }),
    asRelativePath: vi.fn((uri: Uri, includeWorkspaceFolder?: boolean) => {
        const folders = workspace.workspaceFolders || [];
        const folder = folders.find(f => uri.fsPath.startsWith(f.uri.fsPath));
        if (!folder) { return uri.fsPath; }
        let rel = uri.fsPath.slice(folder.uri.fsPath.length);
        if (rel.startsWith('/')) { rel = rel.slice(1); }
        return includeWorkspaceFolder ? `${folder.name}/${rel}` : rel;
    }),
    // Helpers
    resetMockFs: () => mockFs.clear(),
    setMockFile: (path: string, content: string | Uint8Array) => {
        mockFs.set(path, {
            type: FileType.File,
            content: typeof content === 'string' ? new TextEncoder().encode(content) : content
        });
    },
    getFsImpl: () => fsImpl
};

export const window = {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    createOutputChannel: vi.fn((name: string) => ({
        name,
        appendLine: vi.fn(),
        show: vi.fn(),
        dispose: vi.fn(),
        clear: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
    })),
    activeTextEditor: undefined as any,
    visibleTextEditors: [] as any[],
    onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
    registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
};

export const commands = {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
    executeCommand: vi.fn().mockResolvedValue(undefined),
};

export const env = {
    clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
    },
    openExternal: vi.fn().mockResolvedValue(true),
    language: 'en',
};

export enum ExtensionMode {
    Production = 1,
    Development = 2,
    Test = 3
}

export const l10n = {
    t: vi.fn((message: string) => message),
};

export class CancellationTokenSource {
    token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
    cancel = vi.fn();
    dispose = vi.fn();
}

export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
}

export class EventEmitter<T = any> {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
}

export default {
    Uri,
    workspace,
    window,
    commands,
    env,
    FileType,
    UIKind,
    StatusBarAlignment,
    ExtensionMode,
    ConfigurationTarget,
    l10n,
    CancellationTokenSource,
    TreeItemCollapsibleState,
    EventEmitter,
};
