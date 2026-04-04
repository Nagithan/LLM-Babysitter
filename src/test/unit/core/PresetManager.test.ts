import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { PresetManager } from '../../../core/PresetManager.js';
import { LocaleManager } from '../../../i18n/LocaleManager.js';
import { Preset } from '../../../types/index.js';
import { TestUtils } from '../../testUtils.js';

describe('PresetManager Unit Tests', () => {
    let mockContext: any;
    let manager: PresetManager;
    const STORAGE_PATH = '/fake/storage/user-presets.json';

    beforeEach(async () => {
        await TestUtils.fullReset();

        mockContext = {
            globalState: {
                get: vi.fn(),
                update: vi.fn().mockResolvedValue(undefined)
            },
            globalStorageUri: vscode.Uri.file('/fake/storage')
        };

        manager = new PresetManager(mockContext);
        
        // Mock LocaleManager to avoid translation issues in tests
        vi.spyOn(LocaleManager, 'getTranslations').mockReturnValue({
            'preset.name.intro.1': 'Intro 1',
            'template.intro.1': 'Intro content',
            'preset.name.instr.1': 'Instr 1',
            'template.instr.1': 'Instr content',
            'preset.name.instr.2': 'Instr 2',
            'template.instr.2': 'Instr content',
            'preset.name.instr.3': 'Instr 3',
            'template.instr.3': 'Instr content',
            'preset.name.instr.4': 'Instr 4',
            'template.instr.4': 'Instr content',
            'preset.name.instr.5': 'Instr 5',
            'template.instr.5': 'Instr content',
            'preset.name.final.1': 'Final 1',
            'template.final.1': 'Final content',
        });
    });

    describe('initializeMigration', () => {
        it('should migrate legacy presets from globalState to disk', async () => {
            const legacyPresets: Preset[] = [
                { id: 'legacy-1', name: 'Legacy', content: 'Legacy content', type: 'prePrompt' }
            ];
            vi.mocked(mockContext.globalState.get).mockReturnValue(legacyPresets);

            await manager.load();

            // Verify disk write via our mock FS
            const readBack = await vscode.workspace.fs.readFile(vscode.Uri.file(STORAGE_PATH));
            const writtenData = JSON.parse(new TextDecoder().decode(readBack));
            expect(writtenData).toEqual(legacyPresets);

            // Verify globalState cleanup
            expect(mockContext.globalState.update).toHaveBeenCalledWith('backseat-pilot.presets', undefined);
        });

        it('should skip migration if no legacy presets found', async () => {
            vi.mocked(mockContext.globalState.get).mockReturnValue(undefined);

            await manager.load();

            // Should not have created the file if no migration happened
            await expect(vscode.workspace.fs.stat(vscode.Uri.file(STORAGE_PATH))).rejects.toThrow();
        });
    });

    describe('readUserPresets', () => {
        it('should return cached presets if available', async () => {
            const presets: Preset[] = [{ id: '1', name: 'P1', content: 'C1', type: 'prePrompt' }];
            (vscode.workspace as any).setMockFile(STORAGE_PATH, JSON.stringify(presets));

            // First call reads from disk
            await manager.load();
            expect(vscode.workspace.fs.readFile).toHaveBeenCalledTimes(1);

            // Access via getPresets (uses cache)
            const result = manager.getPresets();
            expect(result).toContainEqual(expect.objectContaining(presets[0]));
        });

        it('should handle corrupted JSON by returning empty array', async () => {
            (vscode.workspace as any).setMockFile(STORAGE_PATH, 'invalid-json');
            
            await manager.load();
            
            const result = manager.getPresets();
            // Should at least contain built-ins, but no user presets
            expect(result.filter(p => !p.id.startsWith('built-in'))).toEqual([]);
        });
    });

    describe('savePreset', () => {
        it('should add a new preset and persist to disk', async () => {
            (vscode.workspace as any).setMockFile(STORAGE_PATH, '[]');
            const newPreset: Preset = { id: 'new-1', name: 'New', content: 'Content', type: 'instruction' };

            await manager.savePreset(newPreset);

            const readBack = await vscode.workspace.fs.readFile(vscode.Uri.file(STORAGE_PATH));
            const writtenData = JSON.parse(new TextDecoder().decode(readBack));
            expect(writtenData).toContainEqual(newPreset);
        });

        it('should update an existing preset by ID', async () => {
            const existing: Preset = { id: 'p1', name: 'Old', content: 'Old content', type: 'prePrompt' };
            (vscode.workspace as any).setMockFile(STORAGE_PATH, JSON.stringify([existing]));
            
            const updated: Preset = { ...existing, name: 'Updated' };
            await manager.savePreset(updated);

            const readBack = await vscode.workspace.fs.readFile(vscode.Uri.file(STORAGE_PATH));
            const writtenData = JSON.parse(new TextDecoder().decode(readBack));
            expect(writtenData.length).toBe(1);
            expect(writtenData[0].name).toBe('Updated');
        });
    });

    describe('deletePreset', () => {
        it('should remove preset and persist changes', async () => {
            const p1: Preset = { id: 'p1', name: 'P1', content: 'C1', type: 'prePrompt' };
            const p2: Preset = { id: 'p2', name: 'P2', content: 'C2', type: 'instruction' };
            (vscode.workspace as any).setMockFile(STORAGE_PATH, JSON.stringify([p1, p2]));

            await manager.deletePreset('p1');

            const readBack = await vscode.workspace.fs.readFile(vscode.Uri.file(STORAGE_PATH));
            const writtenData = JSON.parse(new TextDecoder().decode(readBack));
            expect(writtenData.length).toBe(1);
            expect(writtenData[0].id).toBe('p2');
        });
    });

    describe('getPresets', () => {
        it('should return built-in presets even if user presets are empty', () => {
            const presets = manager.getPresets();
            expect(presets.length).toBeGreaterThan(0);
            expect(presets.some(p => p.id.startsWith('built-in'))).toBe(true);
        });
    });
});
