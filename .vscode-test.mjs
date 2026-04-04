import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    // On cible le fichier compilé par TypeScript (dans le dossier out)
    files: 'out/src/test/extension.test.js',
    // Optionnel : on peut préciser la version de VS Code à télécharger
    version: 'stable'
});
