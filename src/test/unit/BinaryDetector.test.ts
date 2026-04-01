import * as assert from 'assert';
import { BinaryDetector } from '../../core/BinaryDetector.js';

/**
 * Unit Tests for BinaryDetector.
 * These tests run in pure Node.js to ensure high-speed verification of heuristics.
 */
describe('BinaryDetector Unit Tests', () => {
    
    it('should identify empty buffers as non-binary', () => {
        assert.strictEqual(BinaryDetector.isBinary(Buffer.from([])), false);
    });

    it('should identify plain text as non-binary', () => {
        const text = 'Hello, this is a plain text file with some symbols: !@#$%^&*()';
        assert.strictEqual(BinaryDetector.isBinary(Buffer.from(text)), false);
    });

    it('should identify buffers with null bytes as binary', () => {
        const data = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
        assert.strictEqual(BinaryDetector.isBinary(data), true);
    });

    it('should identify buffers with high non-printable density as binary', () => {
        // Create a buffer with > 30% non-printable characters (e.g. 0x01, 0x02, etc.)
        const data = Buffer.from([
            0x01, 0x02, 0x03, 0x04, 0x05, // 5 non-printable
            0x41, 0x42, 0x43, 0x44, 0x45  // 5 printable
        ]);
        // 50% non-printable
        assert.strictEqual(BinaryDetector.isBinary(data), true);
    });

    it('should identify valid whitespace as printable', () => {
        const text = 'Line 1\nLine 2\r\n\tIndented line';
        assert.strictEqual(BinaryDetector.isBinary(Buffer.from(text)), false);
    });
});
