import { describe, it, expect } from 'vitest';
import { BinaryDetector } from '../../../core/BinaryDetector.js';

/**
 * Unit Tests for BinaryDetector.
 * These tests run in pure Node.js to ensure high-speed verification of heuristics.
 */
describe('BinaryDetector Unit Tests', () => {
    
    it('should identify empty buffers as non-binary', () => {
        expect(BinaryDetector.isBinary(Buffer.from([]))).toBe(false);
    });

    it('should identify plain text as non-binary', () => {
        const text = 'Hello, this is a plain text file with some symbols: !@#$%^&*()';
        expect(BinaryDetector.isBinary(Buffer.from(text))).toBe(false);
    });

    it('should identify buffers with null bytes as binary', () => {
        const data = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
        expect(BinaryDetector.isBinary(data)).toBe(true);
    });

    it('should identify buffers with high non-printable density as binary', () => {
        // Create a buffer with > 30% non-printable characters (e.g. 0x01, 0x02, etc.)
        const data = Buffer.from([
            0x01, 0x02, 0x03, 0x04, 0x05, // 5 non-printable
            0x41, 0x42, 0x43, 0x44, 0x45  // 5 printable
        ]);
        // 50% non-printable
        expect(BinaryDetector.isBinary(data)).toBe(true);
    });

    it('should identify valid whitespace as printable', () => {
        const text = 'Line 1\nLine 2\r\n\tIndented line';
        expect(BinaryDetector.isBinary(Buffer.from(text))).toBe(false);
    });

    it('should only scan up to MAX_SCAN_BYTES (1024)', () => {
        // Create a buffer of 2000 bytes. 
        // First 1024 are safe printable characters.
        // After 1024, add a null byte.
        const data = Buffer.alloc(2000, 0x41); // 'A'
        data[1025] = 0x00;
        
        expect(BinaryDetector.isBinary(data)).toBe(false); // Should not see the null byte
    });

    it('should respect the 10% control character threshold', () => {
        // 100 bytes. 10 chars are control, 90 are printable.
        // Threshold is > 0.1, so exactly 10% (0.1) should be FALSE.
        const data = Buffer.alloc(100, 0x41);
        for (let i = 0; i < 10; i++) {
            data[i] = 0x01;
        }
        expect(BinaryDetector.isBinary(data)).toBe(false);

        // 11% should be TRUE
        data[10] = 0x01;
        expect(BinaryDetector.isBinary(data)).toBe(true);
    });

    it('should identify DEL (127) as a control character', () => {
        // 10 bytes: 8 'A', 2 DEL. 20% > 10% -> Binary
        const data = Buffer.from([0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 127, 127]);
        expect(BinaryDetector.isBinary(data)).toBe(true);
    });
});
