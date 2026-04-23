import * as vscode from 'vscode';
import ignore from 'ignore';
import { Logger } from './Logger.js';
import { BinaryDetector } from './BinaryDetector.js';

export interface FileNode {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  hasSubdirectories?: boolean;
  children?: FileNode[];
}

export interface FileReadResult {
  kind: 'content' | 'directory' | 'symlink' | 'binary' | 'tooLarge' | 'error';
  content: string;
}

export class FileManager {
  private static readonly MAX_FILE_SIZE = 1024 * 1024; // 1MB limit
  private static readonly HIDDEN_SYSTEM_ENTRIES = new Set(['.git', '.hg', '.svn', '.DS_Store']);
  private static activeScans = new Map<string, Promise<FileNode[]>>();

  private static isDirectory(type: vscode.FileType): boolean {
    return (type & vscode.FileType.Directory) !== 0;
  }

  private static isSymbolicLink(type: vscode.FileType): boolean {
    return (type & vscode.FileType.SymbolicLink) !== 0;
  }

  /**
   * Securely resolves a display path (format: FolderName/relative/path) to a VS Code URI.
   * Throws if the path is invalid or attempts to escape the workspace.
   */
  public static resolveDisplayPath(displayPath: string): vscode.Uri {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folders are currently open.');
    }

    const parts = displayPath.split('/');
    const folderName = parts[0];
    const relativePath = parts.slice(1).join('/');

    const folder = workspaceFolders.find(f => f.name === folderName);
    if (!folder) {
      throw new Error(`Security Error: Workspace folder "${folderName}" not found.`);
    }

    // Resolve the internal URI using the safe joinPath API
    const targetUri = vscode.Uri.joinPath(folder.uri, relativePath);

    // Final verification: ensure the resolved URI is still within the folder's scope.
    // Symbolic links are rejected later during directory listing and file reads.
    const normalizedTarget = targetUri.toString();
    const normalizedFolder = folder.uri.toString();
    const folderPrefix = normalizedFolder.endsWith('/') ? normalizedFolder : normalizedFolder + '/';

    // console.log(`DEBUG resolve: target=${normalizedTarget}, prefix=${folderPrefix}, fold=${normalizedFolder}`);
    if (!normalizedTarget.startsWith(folderPrefix) && normalizedTarget !== normalizedFolder) {
      throw new Error(`Security Error: Resolved path is outside of the workspace folder. Target: ${normalizedTarget}, Prefix: ${folderPrefix}`);
    }

    return targetUri;
  }

  public static async getRoots(): Promise<FileNode[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) { return []; }

    const roots: FileNode[] = [];
    for (const folder of workspaceFolders) {
      // Roots are always directories and we assume they might have subdirectories
      // to avoid heavy pre-scanning. The UI handles lazy loading.
      roots.push({
        name: folder.name,
        relativePath: folder.name,
        isDirectory: true,
        hasSubdirectories: true, // Optimistically true for roots
        children: undefined
      });
    }
    return roots;
  }

  public static async getFolderChildren(displayPath: string): Promise<FileNode[]> {
    const existingScan = this.activeScans.get(displayPath);
    if (existingScan) {
      return existingScan;
    }

    const scanPromise = this._getFolderChildrenInternal(displayPath);
    this.activeScans.set(displayPath, scanPromise);

    try {
      return await scanPromise;
    } finally {
      this.activeScans.delete(displayPath);
    }
  }

  private static async _getFolderChildrenInternal(displayPath: string): Promise<FileNode[]> {
    try {
      const folderUri = this.resolveDisplayPath(displayPath);

      const config = vscode.workspace.getConfiguration('llm-babysitter');
      const userExcludes = config.get<string[]>('excludePatterns') || [];
      const ig = ignore().add(userExcludes);

      const entries = await vscode.workspace.fs.readDirectory(folderUri);

      // Extract relative path from display path for inclusion checks
      const parts = displayPath.split('/');
      const relativePathInFolder = parts.slice(1).join('/');

      const children: FileNode[] = entries
        .map(([name, type]) => {
          if (this.HIDDEN_SYSTEM_ENTRIES.has(name)) { return null; }
          if (this.isSymbolicLink(type)) { return null; }

          const isDirectory = this.isDirectory(type);
          const childRelativePath = relativePathInFolder ? `${relativePathInFolder}/${name}` : name;

          if (ig.ignores(childRelativePath)) {
            return null;
          }

          return {
            name,
            relativePath: displayPath + '/' + name,
            isDirectory,
            // PERFORMANCE OPTIMIZATION: We no longer scan subdirectories here.
            // We assume directories have subdirectories to enable UI chevrons.
            // Lazy loading will handle the "empty directory" case gracefully.
            hasSubdirectories: isDirectory,
            children: undefined // Start as undefined to distinguish from empty results ([])
          } as FileNode;
        })
        .filter((c): c is FileNode => c !== null);

      children.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) { return -1; }
        if (!a.isDirectory && b.isDirectory) { return 1; }
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      return children;
    } catch (e) {
      Logger.getInstance().error(`Failed to read directory ${displayPath}: ${e}`);
      throw e; // Bubble up for IPC handler to catch
    }
  }

  public static async getFileContent(displayPath: string): Promise<FileReadResult> {
    try {
      const fileUri = this.resolveDisplayPath(displayPath);
      const stats = await vscode.workspace.fs.stat(fileUri);

      if (this.isSymbolicLink(stats.type)) {
        return { kind: 'symlink', content: '[Symbolic link - skipped for security]' };
      }
      if (this.isDirectory(stats.type)) {
        return { kind: 'directory', content: '[Selected entry is a directory - skipped]' };
      }
      if (stats.size > this.MAX_FILE_SIZE) {
        return {
          kind: 'tooLarge',
          content: `[File too large (${(stats.size / 1024 / 1024).toFixed(2)} MB) - Baby can't swallow this!]`
        };
      }

      const data = await vscode.workspace.fs.readFile(fileUri);

      // OPTIMIZATION: BinaryDetector already accepts Uint8Array. 
      // Avoid Buffer.from() which potentially copies memory.
      if (BinaryDetector.isBinary(data)) {
        return { kind: 'binary', content: '[Binary file - skipped]' };
      }

      // OPTIMIZATION: Use TextDecoder for cleaner, standard UTF-8 conversion of Uint8Array.
      return { kind: 'content', content: new TextDecoder().decode(data) };
    } catch (e) {
      if (e instanceof vscode.FileSystemError && (e.code === 'FileNotFound' || e.code === 'EntryNotFound')) {
        Logger.getInstance().warn(`File not found: ${displayPath}`);
      } else {
        Logger.getInstance().error(`Failed to read file ${displayPath}: ${e}`);
      }
      return {
        kind: 'error',
        content: `[Error reading file: ${e instanceof Error ? e.message : e}]`
      };
    }
  }
}
