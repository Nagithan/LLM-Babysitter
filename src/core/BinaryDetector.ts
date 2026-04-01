/**
 * Pure Utility for Binary Detection.
 * Responsibility: Analyzes buffers for non-printable characters.
 * Decoupled from VS Code infrastructure for deterministic testing.
 */
export class BinaryDetector {
    private static readonly MAX_SCAN_BYTES = 1024;
    private static readonly CONTROL_CHAR_THRESHOLD = 0.1; // 10%

    /**
     * Estimates if a buffer represents binary data based on null bytes and non-printable percentages.
     * 
     * Heuristic rationale:
     * 1. Null bytes (0x00) are almost never present in standard text files.
     * 2. Control characters (non-whitespace) exceeding 10% typically indicate binary formats 
     *    (compiled code, images, etc.) while allowing for some ANSI escape sequences in text.
     */
    public static isBinary(buffer: Uint8Array): boolean {
        const length = Math.min(buffer.length, this.MAX_SCAN_BYTES);
        if (length === 0) {return false;}

        let controlChars = 0;

        for (let i = 0; i < length; i++) {
            const char = buffer[i];
            
            // 1. Absolute Binary Indicator: Null Byte
            if (char === 0) {return true;}

            // 2. Control Character check:
            // characters 0-31 (excluding TAB: 9, LF: 10, CR: 13) and DEL: 127
            if ((char < 32 && char !== 9 && char !== 10 && char !== 13) || char === 127) {
                controlChars++;
            }
        }

        return (controlChars / length) > this.CONTROL_CHAR_THRESHOLD;
    }
}
