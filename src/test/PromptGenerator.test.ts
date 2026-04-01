import * as assert from 'assert';
import { PromptGenerator } from '../core/PromptGenerator.js';

/**
 * Logic-focused tests for PromptGenerator.
 */
suite('PromptGenerator Test Suite', () => {

    test('estimateTokens() - Zero length text', () => {
        assert.strictEqual(PromptGenerator.estimateTokens(''), 0);
    });

    test('estimateTokens() - Long text estimation', () => {
        const text = 'A'.repeat(400); // 400 chars -> roughly 100 tokens
        const tokens = PromptGenerator.estimateTokens(text);
        assert.ok(tokens > 80 && tokens < 120, `Token estimation should be roughly 100, got ${tokens}`);
    });

    test('generate() - Integration check', async () => {
        // Mocking behavior or using a real file for integration
        // Here we test at least that it produces a non-empty string for valid input
        const prompt = await PromptGenerator.generate('PRE', 'INSTR', 'POST', []);
        assert.ok(prompt.includes('PRE'), 'Should include pre-prompt');
        assert.ok(prompt.includes('INSTR'), 'Should include instruction');
        assert.ok(prompt.includes('POST'), 'Should include post-prompt');
    });
});
