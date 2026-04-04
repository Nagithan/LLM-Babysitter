import { vi } from 'vitest';

// À chaque fois qu'un fichier de test (ou ton code source) fera: 
// import * as vscode from 'vscode'
// Vitest lui donnera ce mock à la place.
vi.mock('vscode', async () => {
    return await import('./mocks/vscode.ts');
});
