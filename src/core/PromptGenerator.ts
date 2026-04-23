import { FileManager } from './FileManager.js';
import { TokenEstimator } from './TokenEstimator.js';
import { PromptAssembler, FileEntry } from './PromptAssembler.js';

/**
 * High-level Prompt Generation Orchestrator.
 * Responsibility: Bridges VS Code infrastructure with pure assembly logic.
 */
export class PromptGenerator {
  private static assembler = new PromptAssembler();

  /**
   * Estimates the token count using the centralized 'TokenEstimator'.
   */
  public static estimateTokens(text: string): number {
    return TokenEstimator.estimate(text);
  }

  /**
   * Orchestrates the assembly of the final prompt string by reading from the filesystem.
   */
  public static async generate(
    prePrompt: string,
    instruction: string,
    postPrompt: string,
    selectedFiles: string[]
  ): Promise<string> {
    if (selectedFiles.length === 0) {
      return this.assembler.assemble(prePrompt, instruction, postPrompt, []);
    }

    const results = await Promise.all(
      selectedFiles.map(async (relativePath) => {
        const fileResult = await FileManager.getFileContent(relativePath);

        if (fileResult.kind === 'directory' || fileResult.kind === 'symlink') {
          return null;
        }

        return { relativePath, content: fileResult.content };
      })
    );

    const fileEntries = results.filter((entry): entry is FileEntry => entry !== null);

    return this.assembler.assemble(
      prePrompt,
      instruction,
      postPrompt,
      fileEntries
    );
  }
}
