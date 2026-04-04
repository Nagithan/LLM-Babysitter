import * as vscode from 'vscode';
import { Preset } from '../types/index.js';
import { LocaleManager } from '../i18n/LocaleManager.js';
import { AsyncQueue } from './AsyncQueue.js';
import { Logger } from './Logger.js';

/**
 * Enhanced Preset Manager for user and built-in templates.
 * Hardened for industrial usage with atomic write queue and disk-based persistence.
 */
export class PresetManager {
  private static readonly PRESETS_KEY = 'llm-babysitter.presets';
  private static readonly STORAGE_FILENAME = 'user-presets.json';
  private queue = new AsyncQueue();
  private userPresetsCache: Preset[] | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  public async load(): Promise<void> {
    await this.initializeMigration();
    await this.readUserPresets();
  }

  /**
   * One-time migration from the legacy 1MB-limited globalState to local disk.
   */
  private async initializeMigration(): Promise<void> {
    const legacyPresets = this.context.globalState.get<Preset[]>(PresetManager.PRESETS_KEY);
    if (!legacyPresets) { return; }

    await this.queue.run(async () => {
      try {
        const fileUri = vscode.Uri.joinPath(this.context.globalStorageUri, PresetManager.STORAGE_FILENAME);
        
        // Ensure directory exists
        await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
        
        // Write to disk
        const data = Buffer.from(JSON.stringify(legacyPresets, null, 2));
        await vscode.workspace.fs.writeFile(fileUri, data);
        
        // Clean up legacy state
        await this.context.globalState.update(PresetManager.PRESETS_KEY, undefined);
        Logger.getInstance().info('Successfully migrated user presets to disk storage.');
      } catch (error: any) {
        Logger.getInstance().error(`Migration failed: ${error.message}`);
      }
    });
  }

  private async readUserPresets(): Promise<Preset[]> {
    if (this.userPresetsCache) { return this.userPresetsCache; }

    try {
      const fileUri = vscode.Uri.joinPath(this.context.globalStorageUri, PresetManager.STORAGE_FILENAME);
      const data = await vscode.workspace.fs.readFile(fileUri);
      const json = JSON.parse(Buffer.from(data).toString('utf-8'));

      if (!Array.isArray(json)) { throw new Error('Invalid storage format: Expected array'); }
      
      // Basic runtime type guard/sanitization
      const validated = json.filter(p => p && typeof p === 'object' && p.id && p.name && p.content && p.type);
      this.userPresetsCache = validated;
      return validated;
    } catch (error) {
      // If file not found or corrupted, start fresh
      this.userPresetsCache = [];
      return [];
    }
  }

  private async writeUserPresets(presets: Preset[]): Promise<void> {
    try {
      const fileUri = vscode.Uri.joinPath(this.context.globalStorageUri, PresetManager.STORAGE_FILENAME);
      await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
      const data = Buffer.from(JSON.stringify(presets, null, 2));
      await vscode.workspace.fs.writeFile(fileUri, data);
      this.userPresetsCache = presets;
    } catch (error: any) {
      Logger.getInstance().error(`Failed to write presets to disk: ${error.message}`);
      throw error;
    }
  }

  public getPresets(): Preset[] {
    // Note: getPresets is synchronous because it's used in UI initializers.
    // It returns the cache if available, or we return built-ins and trigger a lazy refresh.
    // However, in this architecture, we might want to pre-load or use async in handlers.
    // For now, to maintain compatibility with existing sync calls, we use the cache.
    const userPresets = this.userPresetsCache || []; 
    const builtInPresets = this.getBuiltInPresets();
    return [...builtInPresets, ...userPresets];
  }

  private getBuiltInPresets(): Preset[] {
    const t = LocaleManager.getTranslations();
    return [
      { id: 'built-in-intro-1', name: t['preset.name.intro.1'], content: t['template.intro.1'], type: 'prePrompt' },
      { id: 'built-in-instr-1', name: t['preset.name.instr.1'], content: t['template.instr.1'], type: 'instruction' },
      { id: 'built-in-instr-2', name: t['preset.name.instr.2'], content: t['template.instr.2'], type: 'instruction' },
      { id: 'built-in-instr-3', name: t['preset.name.instr.3'], content: t['template.instr.3'], type: 'instruction' },
      { id: 'built-in-instr-4', name: t['preset.name.instr.4'], content: t['template.instr.4'], type: 'instruction' },
      { id: 'built-in-instr-5', name: t['preset.name.instr.5'], content: t['template.instr.5'], type: 'instruction' },
      { id: 'built-in-final-1', name: t['preset.name.final.1'], content: t['template.final.1'], type: 'postPrompt' },
    ];
  }

  /**
   * Atomic operation to save a preset. Prevents data loss via AsyncQueue.
   */
  public async savePreset(preset: Preset): Promise<void> {
    await this.queue.run(async () => {
      const userPresets = await this.readUserPresets();
      const index = userPresets.findIndex(p => p.id === preset.id);
      if (index >= 0) {
        userPresets[index] = preset;
      } else {
        userPresets.push(preset);
      }
      await this.writeUserPresets(userPresets);
    });
  }

  /**
   * Atomic operation to delete a preset. Prevents data loss via AsyncQueue.
   */
  public async deletePreset(id: string): Promise<void> {
    await this.queue.run(async () => {
      const userPresets = await this.readUserPresets();
      const newPresets = userPresets.filter(p => p.id !== id);
      await this.writeUserPresets(newPresets);
    });
  }
}
