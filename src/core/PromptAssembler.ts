import { TokenEstimator } from './TokenEstimator.js';

export interface FileEntry {
    relativePath: string;
    content: string;
}

/**
 * Pure Logic for Prompt Assembly.
 * Responsibility: Concatenates templates and file contents into a final mega-prompt string.
 * Decoupled from VS Code and local filesystem for 100% deterministic unit testing.
 */
export class PromptAssembler {
    /**
     * Assembles the final prompt string from provided components.
     */
    public assemble(
        prePrompt: string,
        instruction: string,
        postPrompt: string,
        files: FileEntry[]
    ): string {
        const parts: string[] = [];

        // Part 1: Pre-prompt
        if (prePrompt.trim()) {
            parts.push(prePrompt.trim() + '\n');
        }

        // Part 2: Main Instruction
        if (instruction.trim()) {
            parts.push('### Instructions');
            parts.push(instruction.trim() + '\n');
        }

        // Part 3: Workspace Context
        if (files.length > 0) {
            parts.push('### Workspace Context');
            parts.push('Below are the contents of the selected files from the workspace:\n');
            
            for (const file of files) {
                const extension = file.relativePath.split('.').pop() || '';
                parts.push(`#### File: ${file.relativePath}`);
                parts.push('```' + extension);
                parts.push(file.content);
                parts.push('```\n');
            }
        }

        // Part 4: Post-prompt / Conclusion
        if (postPrompt.trim()) {
            parts.push('### Additional Context / Conclusion');
            parts.push(postPrompt.trim());
        }

        return parts.join('\n').trim();
    }
}
