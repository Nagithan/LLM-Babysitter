import * as assert from 'assert';
import { TokenEstimator } from '../../core/TokenEstimator.js';

/**
 * Unit Tests for TokenEstimator.
 * Verifies the 4-characters-per-token heuristic calculation.
 */
describe('TokenEstimator Unit Tests', () => {
    
    it('should return 0 for empty or null strings', () => {
        assert.strictEqual(TokenEstimator.estimate(''), 0);
        assert.strictEqual(TokenEstimator.estimate(null as any), 0);
    });

    it('should correctly round up the token count', () => {
        // 1 char -> Math.ceil(1/4) = 1 token
        assert.strictEqual(TokenEstimator.estimate('a'), 1);
        // 4 chars -> Math.ceil(4/4) = 1 token
        assert.strictEqual(TokenEstimator.estimate('abcd'), 1);
        // 5 chars -> Math.ceil(5/4) = 2 tokens
        assert.strictEqual(TokenEstimator.estimate('abcde'), 2);
    });

    it('should calculate large strings accurately', () => {
        const text = 'A'.repeat(100);
        assert.strictEqual(TokenEstimator.estimate(text), 25);
    });
});
