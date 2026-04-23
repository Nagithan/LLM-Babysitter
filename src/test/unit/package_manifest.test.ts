import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('Extension Manifest Defaults', () => {
    it('should exclude common secret files by default', () => {
        const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
        const defaults =
            manifest.contributes.configuration.properties['llm-babysitter.excludePatterns'].default;

        expect(defaults).toEqual(expect.arrayContaining([
            '**/.env',
            '**/.env.*',
            '**/.npmrc',
            '**/.ssh/**',
            '**/*.pem',
            '**/*.key'
        ]));
    });
});
