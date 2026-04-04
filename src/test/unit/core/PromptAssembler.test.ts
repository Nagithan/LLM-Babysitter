import { describe, it, expect } from 'vitest';
import { PromptAssembler} from '../../../core/PromptAssembler.js';
import type { FileEntry } from '../../../core/PromptAssembler.js';

/**
 * Unit Tests for PromptAssembler.
 * Verifies the structural integrity of generated prompts.
 */
describe('PromptAssembler Unit Tests', () => {
    const assembler = new PromptAssembler();

    it('should correctly assemble a basic prompt with one file', () => {
        const prePrompt = "Role: Expert";
        const instruction = "Analyze this:";
        const postPrompt = "Conclusion: Fix all bugs";
        const files: FileEntry[] = [
            { relativePath: 'src/index.ts', content: "console.log('hello');" }
        ];

        const prompt = assembler.assemble(prePrompt, instruction, postPrompt, files);

        expect(prompt).toContain("Role: Expert");
        expect(prompt).toContain("Analyze this:");
        expect(prompt).toContain("#### File: src/index.ts");
        expect(prompt).toContain("console.log('hello');");
        expect(prompt).toContain("Conclusion: Fix all bugs");
        expect(prompt).toContain("### Instructions");
        expect(prompt).toContain("### Workspace Context");
        expect(prompt).toContain("### Additional Context / Conclusion");
    });

    it('should handle empty file lists gracefully', () => {
        const prompt = assembler.assemble("Role", "Do something", "Done", []);
        expect(prompt).not.toContain("### Workspace Context");
    });

    it('should omit empty sections', () => {
        const prompt = assembler.assemble("   ", "Analyze code", "", [{ relativePath: 'a.js', content: 'x' }]);
        expect(prompt).not.toContain("### Additional Context / Conclusion");
    });
});
