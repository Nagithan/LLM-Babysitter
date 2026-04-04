import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      'vscode': resolve(__dirname, './src/test/mocks/vscode.ts'),
    },
    // 1. On cible UNIQUEMENT le dossier unit
    include: ['src/test/unit/**/*.test.ts'], 
    // 2. On exclut explicitement le test d'intégration
    exclude: ['out/**', 'node_modules/**', 'dist/**', 'src/test/extension.test.ts'],
    // 3. On charge le mock vscode globalement AVANT les tests
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**'],
    },
    // @ts-expect-error - environmentMatchGlobs might not be in the InlineConfig type for this version
    environmentMatchGlobs: [
      ['src/test/unit/webview/**', 'jsdom'],
    ],
  },
});
