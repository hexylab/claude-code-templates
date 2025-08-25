/**
 * Tests for i18n module
 */

const fs = require('fs');
const path = require('path');
const { I18n, init, getI18n, t, setLanguage, getLanguage, getAvailableLanguages, parseLanguageFromArgs } = require('../../src/i18n');

// Mock locale files for testing
const mockLocalesDir = path.join(__dirname, 'mock-locales');
const mockEnContent = {
  "_meta": {
    "name": "English",
    "nativeName": "English",
    "direction": "ltr"
  },
  "app": {
    "name": "Test App",
    "version": "Version {version}"
  },
  "common": {
    "yes": "Yes",
    "no": "No"
  },
  "nested": {
    "deep": {
      "value": "Deep nested value"
    }
  }
};

const mockJaContent = {
  "_meta": {
    "name": "Japanese", 
    "nativeName": "日本語",
    "direction": "ltr"
  },
  "app": {
    "name": "テストアプリ"
  },
  "common": {
    "yes": "はい"
  }
};

describe('I18n Module', () => {
  beforeAll(() => {
    // Create mock locales directory
    if (!fs.existsSync(mockLocalesDir)) {
      fs.mkdirSync(mockLocalesDir, { recursive: true });
    }
    
    // Write mock locale files
    fs.writeFileSync(
      path.join(mockLocalesDir, 'en.json'),
      JSON.stringify(mockEnContent, null, 2)
    );
    
    fs.writeFileSync(
      path.join(mockLocalesDir, 'ja.json'), 
      JSON.stringify(mockJaContent, null, 2)
    );
  });

  afterAll(() => {
    // Clean up mock files
    if (fs.existsSync(mockLocalesDir)) {
      fs.rmSync(mockLocalesDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Reset singleton instance for each test
    jest.resetModules();
  });

  describe('I18n Class', () => {
    test('should create instance with default options', () => {
      const i18n = new I18n({ localesDir: mockLocalesDir });
      expect(i18n.locale).toBeDefined();
      expect(i18n.fallbackLocale).toBe('en');
    });

    test('should load locale files correctly', () => {
      const i18n = new I18n({ 
        localesDir: mockLocalesDir,
        locale: 'en'
      });
      
      expect(i18n.translations.en).toEqual(mockEnContent);
    });

    test('should get available languages', () => {
      const i18n = new I18n({ localesDir: mockLocalesDir });
      const languages = i18n.getAvailableLanguages();
      
      expect(languages).toContain('en');
      expect(languages).toContain('ja');
      expect(languages).toHaveLength(2);
    });
  });

  describe('Translation Function', () => {
    test('should translate simple keys', () => {
      const i18n = new I18n({ 
        localesDir: mockLocalesDir,
        locale: 'en'
      });
      
      expect(i18n.t('app.name')).toBe('Test App');
      expect(i18n.t('common.yes')).toBe('Yes');
    });

    test('should handle nested keys', () => {
      const i18n = new I18n({ 
        localesDir: mockLocalesDir,
        locale: 'en'
      });
      
      expect(i18n.t('nested.deep.value')).toBe('Deep nested value');
    });

    test('should interpolate parameters', () => {
      const i18n = new I18n({ 
        localesDir: mockLocalesDir,
        locale: 'en'
      });
      
      const result = i18n.t('app.version', { version: '1.0.0' });
      expect(result).toBe('Version 1.0.0');
    });

    test('should fallback to fallback locale for missing keys', () => {
      const i18n = new I18n({ 
        localesDir: mockLocalesDir,
        locale: 'ja'
      });
      
      // Key exists in Japanese
      expect(i18n.t('app.name')).toBe('テストアプリ');
      
      // Key missing in Japanese, should fallback to English
      expect(i18n.t('common.no')).toBe('No');
    });

    test('should return key itself when translation missing', () => {
      const i18n = new I18n({ 
        localesDir: mockLocalesDir,
        locale: 'en'
      });
      
      expect(i18n.t('missing.key')).toBe('missing.key');
    });
  });

  describe('Language Switching', () => {
    test('should switch language successfully', () => {
      const i18n = new I18n({ 
        localesDir: mockLocalesDir,
        locale: 'en'
      });
      
      expect(i18n.getLanguage()).toBe('en');
      
      const success = i18n.setLanguage('ja');
      expect(success).toBe(true);
      expect(i18n.getLanguage()).toBe('ja');
    });

    test('should handle invalid language gracefully', () => {
      const i18n = new I18n({ 
        localesDir: mockLocalesDir,
        locale: 'en'
      });
      
      const originalLang = i18n.getLanguage();
      const success = i18n.setLanguage('invalid');
      
      expect(success).toBe(false);
      expect(i18n.getLanguage()).toBe(originalLang);
    });
  });

  describe('Module Functions', () => {
    test('should initialize with custom options', () => {
      const i18n = init({ 
        localesDir: mockLocalesDir,
        locale: 'ja'
      });
      
      expect(i18n.getLanguage()).toBe('ja');
    });

    test('should use singleton pattern', () => {
      const i18n1 = getI18n({ localesDir: mockLocalesDir });
      const i18n2 = getI18n();
      
      expect(i18n1).toBe(i18n2);
    });

    test('should work with shorthand t function', () => {
      init({ 
        localesDir: mockLocalesDir,
        locale: 'en'
      });
      
      expect(t('app.name')).toBe('Test App');
      expect(t('app.version', { version: '2.0.0' })).toBe('Version 2.0.0');
    });

    test('should work with module language functions', () => {
      init({ 
        localesDir: mockLocalesDir,
        locale: 'en'
      });
      
      expect(getLanguage()).toBe('en');
      
      setLanguage('ja');
      expect(getLanguage()).toBe('ja');
      
      const available = getAvailableLanguages();
      expect(available).toContain('en');
      expect(available).toContain('ja');
    });
  });

  describe('parseLanguageFromArgs', () => {
    test('should parse --lang argument', () => {
      const args = ['node', 'script.js', '--lang', 'ja'];
      expect(parseLanguageFromArgs(args)).toBe('ja');
    });

    test('should parse --language argument', () => {
      const args = ['node', 'script.js', '--language', 'fr'];
      expect(parseLanguageFromArgs(args)).toBe('fr');
    });

    test('should parse --lang=code format', () => {
      const args = ['node', 'script.js', '--lang=es'];
      expect(parseLanguageFromArgs(args)).toBe('es');
    });

    test('should parse --language=code format', () => {
      const args = ['node', 'script.js', '--language=de'];
      expect(parseLanguageFromArgs(args)).toBe('de');
    });

    test('should return null when no language argument found', () => {
      const args = ['node', 'script.js', '--other-arg'];
      expect(parseLanguageFromArgs(args)).toBeNull();
    });

    test('should return null when language argument has no value', () => {
      const args = ['node', 'script.js', '--lang'];
      expect(parseLanguageFromArgs(args)).toBeNull();
    });
  });

  describe('Locale Metadata', () => {
    test('should return locale info', () => {
      const i18n = new I18n({ 
        localesDir: mockLocalesDir,
        locale: 'ja'
      });
      
      const info = i18n.getLocaleInfo();
      expect(info).toEqual({
        locale: 'ja',
        name: 'Japanese',
        nativeName: '日本語',
        direction: 'ltr',
        completeness: null
      });
    });

    test('should return null for missing locale info', () => {
      const i18n = new I18n({ 
        localesDir: mockLocalesDir,
        locale: 'en'
      });
      
      const info = i18n.getLocaleInfo('missing');
      expect(info).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing locales directory', () => {
      expect(() => {
        new I18n({ 
          localesDir: '/nonexistent/path',
          locale: 'en'
        });
      }).toThrow();
    });

    test('should handle malformed JSON gracefully', () => {
      const badLocalesDir = path.join(__dirname, 'bad-locales');
      
      if (!fs.existsSync(badLocalesDir)) {
        fs.mkdirSync(badLocalesDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(badLocalesDir, 'en.json'),
        '{ invalid json'
      );
      
      expect(() => {
        new I18n({ 
          localesDir: badLocalesDir,
          locale: 'en'
        });
      }).toThrow();
      
      // Cleanup
      fs.rmSync(badLocalesDir, { recursive: true, force: true });
    });
  });
});