import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptGenerator } from '../../../core/PromptGenerator.js';
import { FileManager } from '../../../core/FileManager.js';
import { TestUtils } from '../../testUtils.js';

/**
 * Unit Tests for PromptGenerator.
 */
describe('PromptGenerator Unit Tests', () => {

    beforeEach(async () => {
        await TestUtils.fullReset();
    });

    it('should estimate tokens correctly for short text', () => {
        expect(PromptGenerator.estimateTokens('')).toBe(0);
        expect(PromptGenerator.estimateTokens('abcd')).toBe(1);
    });

    it('should estimate tokens correctly for long text', () => {
        const text = 'A'.repeat(400); // 400 chars -> roughly 100 tokens
        const tokens = PromptGenerator.estimateTokens(text);
        expect(tokens).toBeGreaterThan(80);
        expect(tokens).toBeLessThan(120);
    });

    it('should generate a prompt without files', async () => {
        const prompt = await PromptGenerator.generate('PRE', 'INSTR', 'POST', []);
        
        expect(prompt).toContain('PRE');
        expect(prompt).toContain('INSTR');
        expect(prompt).toContain('POST');
    });

    it('should generate a prompt with selected files', async () => {
        // Mock FileManager.getFileContent (static method needs vi.spyOn)
        vi.spyOn(FileManager, 'getFileContent').mockImplementation(async (path) => {
            if (path === 'file1.ts') { return 'content1'; }
            if (path === 'file2.ts') { return 'content2'; }
            return '';
        });

        const prompt = await PromptGenerator.generate('PRE', 'INSTR', 'POST', ['file1.ts', 'file2.ts']);
        
        expect(prompt).toContain('PRE');
        expect(prompt).toContain('INSTR');
        expect(prompt).toContain('POST');
        expect(prompt).toContain('file1.ts');
        expect(prompt).toContain('content1');
        expect(prompt).toContain('file2.ts');
        expect(prompt).toContain('content2');
    });

    it('should skip directories during generation', async () => {
        vi.spyOn(FileManager, 'getFileContent').mockResolvedValue('[Selected entry is a directory - skipped]');

        const prompt = await PromptGenerator.generate('PRE', 'INSTR', 'POST', ['some-dir']);
        
        // Should not contain the directory content marker in the final output
        expect(prompt).not.toContain('directory - skipped');
    });
});
