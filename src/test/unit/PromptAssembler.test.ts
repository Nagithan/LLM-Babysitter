import * as assert from 'assert';
import { PromptAssembler, FileEntry } from '../../core/PromptAssembler.js';

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

        assert.ok(prompt.includes("Role: Expert"), 'Should contain prePrompt');
        assert.ok(prompt.includes("Analyze this:"), 'Should contain main instruction');
        assert.ok(prompt.includes("#### File: src/index.ts"), 'Should contain file header');
        assert.ok(prompt.includes("console.log('hello');"), 'Should contain file content');
        assert.ok(prompt.includes("Conclusion: Fix all bugs"), 'Should contain postPrompt');
        assert.ok(prompt.includes("### Instructions"), 'Should contain structural section header');
        assert.ok(prompt.includes("### Workspace Context"), 'Should contain structural section header');
        assert.ok(prompt.includes("### Additional Context / Conclusion"), 'Should contain structural section header');
    });

    it('should handle empty file lists gracefully', () => {
        const prompt = assembler.assemble("Role", "Do something", "Done", []);
        assert.ok(!prompt.includes("### Workspace Context"), 'Should not contain workspace section if empty');
    });

    it('should omit empty sections', () => {
        const prompt = assembler.assemble("   ", "Analyze code", "", [{ relativePath: 'a.js', content: 'x' }]);
        assert.ok(!prompt.includes("### Additional Context / Conclusion"), 'Should omit empty post-prompt');
    });
});
