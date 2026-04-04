import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TokenEstimator } from '../../../core/TokenEstimator.js';

describe('TokenEstimator Property-Based Tests', () => {
    
    it('TokenEstimator.estimate property: non-negative and finite', () => {
        fc.assert(
            fc.property(fc.string(), (input) => {
                const estimate = TokenEstimator.estimate(input);
                expect(estimate).toBeGreaterThanOrEqual(0);
                expect(Number.isFinite(estimate)).toBe(true);
            })
        );
    });

    it('TokenEstimator.estimate property: monotonicity (longer string >= shorter string)', () => {
        fc.assert(
            fc.property(fc.string(), fc.string(), (base, extra) => {
                const e1 = TokenEstimator.estimate(base);
                const e2 = TokenEstimator.estimate(base + extra);
                expect(e2).toBeGreaterThanOrEqual(e1);
            })
        );
    });

    it('TokenEstimator.estimate property: sub-additivity (est(a+b) <= est(a) + est(b) + 1)', () => {
        fc.assert(
            fc.property(fc.string(), fc.string(), (a, b) => {
                const eA = TokenEstimator.estimate(a);
                const eB = TokenEstimator.estimate(b);
                const eTotal = TokenEstimator.estimate(a + b);
                
                // Heuristic estimation might vary slightly if bridge/tokenization overlaps,
                // but for simple 4-char rule it should be roughly equal.
                expect(eTotal).toBeLessThanOrEqual(eA + eB + 1);
            })
        );
    });

    it('TokenEstimator.estimate property: empty string is zero', () => {
        expect(TokenEstimator.estimate('')).toBe(0);
    });

    it('TokenEstimator.estimate property: whitespace still counts', () => {
        fc.assert(
            fc.property(fc.string({ minLength: 1 }), (input) => {
                const estimate = TokenEstimator.estimate(input);
                // Even with only whitespace, for 4 chars it should be non-zero if large enough
                if (input.length >= 4) {
                    expect(estimate).toBeGreaterThan(0);
                }
            })
        );
    });
});
