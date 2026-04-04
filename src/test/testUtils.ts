import * as vscode from 'vscode';
import { vi } from 'vitest';

/**
 * Shared utilities for unit tests to reduce boilerplate and improve readability.
 */
export class TestUtils {
  /**
   * Sets up mock workspace folders in the VS Code mock.
   */
  static setupWorkspaceFolders(folders: { name: string; path: string }[]) {
    (vscode.workspace as any).workspaceFolders = folders.map((f, index) => ({
      uri: vscode.Uri.file(f.path),
      name: f.name,
      index
    }));
  }

  /**
   * Clears the mock workspace folders.
   */
  static clearWorkspaceFolders() {
    (vscode.workspace as any).workspaceFolders = undefined;
  }

  /**
   * Resets all common mocks and clears the mock filesystem.
   */
  static async fullReset() {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    
    // Explicitly reset the implementations of our custom mocks to their defaults
    const ws = vscode.workspace as any;
    const fsImpl = ws.getFsImpl?.();
    if (fsImpl) {
        vi.mocked(vscode.workspace.fs.stat).mockImplementation(fsImpl.stat);
        vi.mocked(vscode.workspace.fs.readFile).mockImplementation(fsImpl.readFile);
        vi.mocked(vscode.workspace.fs.readDirectory).mockImplementation(fsImpl.readDirectory);
        vi.mocked(vscode.workspace.fs.writeFile).mockImplementation(fsImpl.writeFile);
        vi.mocked(vscode.workspace.fs.delete).mockImplementation(fsImpl.delete);
        vi.mocked(vscode.workspace.fs.createDirectory).mockImplementation(fsImpl.createDirectory);
    }

    if (ws.resetMockFs) {
      ws.resetMockFs();
    }
    this.clearWorkspaceFolders();
  }

  /**
   * Helper to create a deferred promise for testing async flows.
   */
  static deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
}
