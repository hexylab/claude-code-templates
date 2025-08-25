/**
 * Tests for translation validation script
 */

const fs = require('fs');
const path = require('path');
const TranslationValidator = require('../../scripts/validate-translations');

// Mock locales for testing
const mockLocalesDir = path.join(__dirname, 'mock-validation-locales');

const mockEnContent = {
  "app": {
    "name": "Test App",
    "version": "Version {version}"
  },
  "common": {
    "yes": "Yes",
    "no": "No",
    "cancel": "Cancel"
  },
  "nested": {
    "deep": {
      "value": "Deep value"
    }
  }
};

const mockJaComplete = {
  "app": {
    "name": "テストアプリ",
    "version": "バージョン {version}"
  },
  "common": {
    "yes": "はい",
    "no": "いいえ",
    "cancel": "キャンセル"
  },
  "nested": {
    "deep": {
      "value": "深い値"
    }
  }
};

const mockJaIncomplete = {
  "_comment": "Incomplete translation for testing",
  "app": {
    "name": "テストアプリ"
  },
  "common": {
    "yes": "はい"
  }
};

const mockJaWithExtra = {
  "app": {
    "name": "テストアプリ",
    "version": "バージョン {version}",
    "extra": "Extra key not in master"
  },
  "common": {
    "yes": "はい",
    "no": "いいえ",
    "cancel": "キャンセル"
  },
  "nested": {
    "deep": {
      "value": "深い値"
    }
  },
  "additional": {
    "key": "Additional section"
  }
};

describe('TranslationValidator', () => {
  beforeAll(() => {
    // Create mock locales directory
    if (!fs.existsSync(mockLocalesDir)) {
      fs.mkdirSync(mockLocalesDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up mock files
    if (fs.existsSync(mockLocalesDir)) {
      fs.rmSync(mockLocalesDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up any existing files
    const files = fs.readdirSync(mockLocalesDir).filter(f => f.endsWith('.json'));
    files.forEach(file => {
      fs.unlinkSync(path.join(mockLocalesDir, file));
    });
  });

  describe('Key Extraction', () => {
    test('should extract flat keys correctly', () => {
      const validator = new TranslationValidator();
      const obj = {
        "key1": "value1",
        "key2": "value2"
      };
      
      const keys = validator.extractKeys(obj);
      expect(keys).toEqual(['key1', 'key2']);
    });

    test('should extract nested keys correctly', () => {
      const validator = new TranslationValidator();
      const keys = validator.extractKeys(mockEnContent);
      
      expect(keys).toContain('app.name');
      expect(keys).toContain('app.version');
      expect(keys).toContain('common.yes');
      expect(keys).toContain('nested.deep.value');
      expect(keys).toHaveLength(6);
    });

    test('should skip comment keys', () => {
      const validator = new TranslationValidator();
      const obj = {
        "_comment": "This should be ignored",
        "_meta": "This should also be ignored",
        "validKey": "This should be included"
      };
      
      const keys = validator.extractKeys(obj);
      expect(keys).toEqual(['validKey']);
      expect(keys).not.toContain('_comment');
      expect(keys).not.toContain('_meta');
    });
  });

  describe('File Loading', () => {
    test('should load valid JSON files', () => {
      const validator = new TranslationValidator({ localesDir: mockLocalesDir });
      
      // Write test file
      fs.writeFileSync(
        path.join(mockLocalesDir, 'en.json'),
        JSON.stringify(mockEnContent, null, 2)
      );
      
      const data = validator.loadLanguageFile('en.json');
      expect(data).toEqual(mockEnContent);
    });

    test('should throw error for missing files', () => {
      const validator = new TranslationValidator({ localesDir: mockLocalesDir });
      
      expect(() => {
        validator.loadLanguageFile('missing.json');
      }).toThrow('Language file not found');
    });

    test('should throw error for invalid JSON', () => {
      const validator = new TranslationValidator({ localesDir: mockLocalesDir });
      
      // Write invalid JSON
      fs.writeFileSync(
        path.join(mockLocalesDir, 'invalid.json'),
        '{ invalid json content'
      );
      
      expect(() => {
        validator.loadLanguageFile('invalid.json');
      }).toThrow('Failed to parse invalid.json');
    });
  });

  describe('Key Comparison', () => {
    test('should detect perfect match', () => {
      const validator = new TranslationValidator();
      const masterKeys = ['key1', 'key2', 'key3'];
      const targetKeys = ['key1', 'key2', 'key3'];
      
      const result = validator.compareKeys(masterKeys, targetKeys, 'test.json');
      
      expect(result.isComplete).toBe(true);
      expect(result.missingKeys).toHaveLength(0);
      expect(result.extraKeys).toHaveLength(0);
      expect(result.coverage).toBe(100);
    });

    test('should detect missing keys', () => {
      const validator = new TranslationValidator();
      const masterKeys = ['key1', 'key2', 'key3'];
      const targetKeys = ['key1'];
      
      const result = validator.compareKeys(masterKeys, targetKeys, 'test.json');
      
      expect(result.isComplete).toBe(false);
      expect(result.missingKeys).toEqual(['key2', 'key3']);
      expect(result.extraKeys).toHaveLength(0);
      expect(result.coverage).toBe(33.33);
    });

    test('should detect extra keys', () => {
      const validator = new TranslationValidator();
      const masterKeys = ['key1', 'key2'];
      const targetKeys = ['key1', 'key2', 'key3'];
      
      const result = validator.compareKeys(masterKeys, targetKeys, 'test.json');
      
      expect(result.isComplete).toBe(false);
      expect(result.missingKeys).toHaveLength(0);
      expect(result.extraKeys).toEqual(['key3']);
      expect(result.coverage).toBe(100);
    });

    test('should detect mixed issues', () => {
      const validator = new TranslationValidator();
      const masterKeys = ['key1', 'key2', 'key3'];
      const targetKeys = ['key1', 'key4'];
      
      const result = validator.compareKeys(masterKeys, targetKeys, 'test.json');
      
      expect(result.isComplete).toBe(false);
      expect(result.missingKeys).toEqual(['key2', 'key3']);
      expect(result.extraKeys).toEqual(['key4']);
      expect(result.coverage).toBe(33.33);
    });
  });

  describe('Full Validation', () => {
    test('should handle no additional language files', async () => {
      const validator = new TranslationValidator({ localesDir: mockLocalesDir });
      
      // Write only master file
      fs.writeFileSync(
        path.join(mockLocalesDir, 'en.json'),
        JSON.stringify(mockEnContent, null, 2)
      );
      
      const results = await validator.validate();
      
      expect(results.masterKeyCount).toBe(6);
      expect(results.languages).toHaveLength(0);
    });

    test('should validate complete translations', async () => {
      const validator = new TranslationValidator({ localesDir: mockLocalesDir });
      
      // Write master and complete translation
      fs.writeFileSync(
        path.join(mockLocalesDir, 'en.json'),
        JSON.stringify(mockEnContent, null, 2)
      );
      fs.writeFileSync(
        path.join(mockLocalesDir, 'ja.json'),
        JSON.stringify(mockJaComplete, null, 2)
      );
      
      const results = await validator.validate();
      
      expect(results.languages).toHaveLength(1);
      expect(results.languages[0].isComplete).toBe(true);
      expect(results.languages[0].coverage).toBe(100);
      expect(results.languages[0].missingKeys).toHaveLength(0);
      expect(results.languages[0].extraKeys).toHaveLength(0);
    });

    test('should validate incomplete translations', async () => {
      const validator = new TranslationValidator({ localesDir: mockLocalesDir });
      
      // Write master and incomplete translation
      fs.writeFileSync(
        path.join(mockLocalesDir, 'en.json'),
        JSON.stringify(mockEnContent, null, 2)
      );
      fs.writeFileSync(
        path.join(mockLocalesDir, 'ja.json'),
        JSON.stringify(mockJaIncomplete, null, 2)
      );
      
      const results = await validator.validate();
      
      expect(results.languages).toHaveLength(1);
      expect(results.languages[0].isComplete).toBe(false);
      expect(results.languages[0].coverage).toBe(33.33);
      expect(results.languages[0].missingKeys.length).toBeGreaterThan(0);
    });

    test('should detect extra keys', async () => {
      const validator = new TranslationValidator({ localesDir: mockLocalesDir });
      
      // Write master and translation with extra keys
      fs.writeFileSync(
        path.join(mockLocalesDir, 'en.json'),
        JSON.stringify(mockEnContent, null, 2)
      );
      fs.writeFileSync(
        path.join(mockLocalesDir, 'ja.json'),
        JSON.stringify(mockJaWithExtra, null, 2)
      );
      
      const results = await validator.validate();
      
      expect(results.languages).toHaveLength(1);
      expect(results.languages[0].isComplete).toBe(false);
      expect(results.languages[0].extraKeys.length).toBeGreaterThan(0);
      expect(results.languages[0].extraKeys).toContain('app.extra');
      expect(results.languages[0].extraKeys).toContain('additional.key');
    });
  });

  describe('Validation Modes', () => {
    beforeEach(async () => {
      // Set up incomplete translation for mode testing
      fs.writeFileSync(
        path.join(mockLocalesDir, 'en.json'),
        JSON.stringify(mockEnContent, null, 2)
      );
      fs.writeFileSync(
        path.join(mockLocalesDir, 'ja.json'),
        JSON.stringify(mockJaIncomplete, null, 2)
      );
    });

    test('should handle allow-missing mode', async () => {
      const validator = new TranslationValidator({ 
        localesDir: mockLocalesDir,
        allowMissing: true 
      });
      
      const exitCode = await validator.run();
      expect(exitCode).toBe(0); // Should not fail in allow-missing mode
    });

    test('should handle warn-only mode', async () => {
      const validator = new TranslationValidator({ 
        localesDir: mockLocalesDir,
        warnOnly: true 
      });
      
      const exitCode = await validator.run();
      expect(exitCode).toBe(0); // Should not fail in warn-only mode
    });

    test('should fail in strict mode with missing keys', async () => {
      const validator = new TranslationValidator({ 
        localesDir: mockLocalesDir,
        strict: false // Default behavior (strict)
      });
      
      const exitCode = await validator.run();
      expect(exitCode).toBe(1); // Should fail with missing keys
    });
  });

  describe('Report Generation', () => {
    test('should generate JSON report when requested', async () => {
      const validator = new TranslationValidator({ 
        localesDir: mockLocalesDir,
        generateReport: true
      });
      
      // Set up test files
      fs.writeFileSync(
        path.join(mockLocalesDir, 'en.json'),
        JSON.stringify(mockEnContent, null, 2)
      );
      fs.writeFileSync(
        path.join(mockLocalesDir, 'ja.json'),
        JSON.stringify(mockJaIncomplete, null, 2)
      );
      
      // Mock process.cwd to return a temp directory for the report
      const originalCwd = process.cwd;
      const tempReportDir = path.join(__dirname, 'temp-reports');
      fs.mkdirSync(tempReportDir, { recursive: true });
      
      process.cwd = () => tempReportDir;
      
      try {
        await validator.run();
        
        const reportPath = path.join(tempReportDir, 'translation-report.json');
        expect(fs.existsSync(reportPath)).toBe(true);
        
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        expect(report.master).toBeDefined();
        expect(report.languages).toBeDefined();
        expect(report.summary).toBeDefined();
        
        // Clean up
        fs.rmSync(tempReportDir, { recursive: true, force: true });
      } finally {
        process.cwd = originalCwd;
      }
    });
  });
});