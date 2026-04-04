import { describe, it, expect } from 'vitest';
import { TokenEstimator } from '../../../core/TokenEstimator.js';

/**
 * Unit Tests for TokenEstimator.
 * Verifies the 4-characters-per-token heuristic calculation.
 */
describe('TokenEstimator Unit Tests', () => {
    
    it('should return 0 for empty or null strings', () => {
        expect(TokenEstimator.estimate('')).toBe(0);
        expect(TokenEstimator.estimate(null as any)).toBe(0);
    });

    it('should correctly round up the token count', () => {
        // 1 char -> Math.ceil(1/4) = 1 token
        expect(TokenEstimator.estimate('a')).toBe(1);
        // 4 chars -> Math.ceil(4/4) = 1 token
        expect(TokenEstimator.estimate('abcd')).toBe(1);
        // 5 chars -> Math.ceil(5/4) = 2 tokens
        expect(TokenEstimator.estimate('abcde')).toBe(2);
    });

    it('should calculate large strings accurately', () => {
        const text = 'A'.repeat(100);
        expect(TokenEstimator.estimate(text)).toBe(25);
    });
});
