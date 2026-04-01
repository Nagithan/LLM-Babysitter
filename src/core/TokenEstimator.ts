/**
 * Pure Utility for Token Estimation.
 * Responsibility: Aggregates token heuristic logic for text and file content.
 * Decoupled from VS Code infrastructure for deterministic testing.
 */
export class TokenEstimator {
    /**
     * Estimates the token count for a text using the 4-characters-per-token heuristic.
     */
    public static estimate(text: string): number {
        if (!text) {return 0;}
        return Math.ceil(text.length / 4);
    }
}
