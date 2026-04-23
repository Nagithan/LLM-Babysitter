import { describe, it, expect } from 'vitest';
import { LocaleManager } from '../../../i18n/LocaleManager.js';
import { TRANSLATIONS } from '../../../i18n/translations.js';

describe('LocaleManager Unit Tests', () => {
    it('should always return the English translation table', () => {
        expect(LocaleManager.getTranslations()).toEqual(TRANSLATIONS);
    });

    it('should return the correct English translation for a given key', () => {
        expect(LocaleManager.getTranslation('app.title')).toBe('LLM Babysitter');
        expect(LocaleManager.getTranslation('button.copy')).toBe('Copy to clipboard');
    });

    it('should return the key itself if not found in the translation table', () => {
        expect(LocaleManager.getTranslation('non.existent.key' as never)).toBe('non.existent.key');
    });
});
