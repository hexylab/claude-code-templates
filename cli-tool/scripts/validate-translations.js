#!/usr/bin/env node
/**
 * Translation Validation Script
 * Validates translation key consistency between master (en.json) and other language files
 */

const fs = require('fs');
const path = require('path');

class TranslationValidator {
  constructor(options = {}) {
    this.strict = options.strict || false;
    this.warnOnly = options.warnOnly || false;
    this.allowMissing = options.allowMissing || false;
    this.generateReport = options.generateReport || false;
    this.localesDir = path.join(__dirname, '..', 'locales');
    this.masterFile = 'en.json';
    this.report = {
      timestamp: new Date().toISOString(),
      master: {},
      languages: {},
      summary: {}
    };
  }

  /**
   * Extract all keys from a nested object recursively
   */
  extractKeys(obj, prefix = '') {
    const keys = [];
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip comment keys
      if (key.startsWith('_')) {
        continue;
      }
      
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        keys.push(...this.extractKeys(value, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    
    return keys.sort();
  }

  /**
   * Load and parse a JSON language file
   */
  loadLanguageFile(filename) {
    const filePath = path.join(this.localesDir, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Language file not found: ${filePath}`);
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse ${filename}: ${error.message}`);
    }
  }

  /**
   * Compare keys between master and target language
   */
  compareKeys(masterKeys, targetKeys, language) {
    const missingKeys = masterKeys.filter(key => !targetKeys.includes(key));
    const extraKeys = targetKeys.filter(key => !masterKeys.includes(key));
    
    const coverage = masterKeys.length > 0 
      ? ((targetKeys.length - extraKeys.length) / masterKeys.length * 100).toFixed(2)
      : 0;

    return {
      language,
      totalKeys: targetKeys.length,
      missingKeys,
      extraKeys,
      coverage: parseFloat(coverage),
      isComplete: missingKeys.length === 0 && extraKeys.length === 0
    };
  }

  /**
   * Generate validation report
   */
  generateValidationReport(results) {
    console.log('\n='.repeat(50));
    console.log('Translation Validation Report');
    console.log('='.repeat(50));
    console.log(`Generated: ${new Date().toLocaleString()}`);
    console.log(`Master: ${this.masterFile} (${results.masterKeyCount} keys)`);
    
    if (results.languages.length === 0) {
      console.log('\nNo additional language files found.');
      return;
    }

    results.languages.forEach(lang => {
      console.log(`\n${lang.language}:`);
      console.log(`- Total keys: ${lang.totalKeys}`);
      console.log(`- Missing keys: ${lang.missingKeys.length}`);
      console.log(`- Extra keys: ${lang.extraKeys.length}`);
      console.log(`- Coverage: ${lang.coverage}%`);
      
      if (lang.missingKeys.length > 0) {
        const displayCount = Math.min(lang.missingKeys.length, 10);
        console.log(`\nMissing keys in ${lang.language} (showing ${displayCount}/${lang.missingKeys.length}):`);
        lang.missingKeys.slice(0, displayCount).forEach(key => {
          console.log(`  - ${key}`);
        });
        
        if (lang.missingKeys.length > displayCount) {
          console.log(`  ... and ${lang.missingKeys.length - displayCount} more`);
        }
      }
      
      if (lang.extraKeys.length > 0) {
        console.log(`\nExtra keys in ${lang.language}:`);
        lang.extraKeys.forEach(key => {
          console.log(`  + ${key}`);
        });
      }
    });

    // Summary
    const totalIssues = results.languages.reduce((sum, lang) => 
      sum + lang.missingKeys.length + lang.extraKeys.length, 0);
    
    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    console.log(`- Languages validated: ${results.languages.length}`);
    console.log(`- Total issues found: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('✅ All translations are in sync!');
    } else if (this.allowMissing) {
      console.log('⚠️  Issues found but allowed in current mode');
    } else {
      console.log('❌ Translation sync issues detected');
    }
  }

  /**
   * Save JSON report to file
   */
  saveJsonReport(results) {
    const reportPath = path.join(process.cwd(), 'translation-report.json');
    this.report.master = {
      file: this.masterFile,
      keyCount: results.masterKeyCount
    };
    this.report.languages = results.languages;
    this.report.summary = {
      totalLanguages: results.languages.length,
      totalIssues: results.languages.reduce((sum, lang) => 
        sum + lang.missingKeys.length + lang.extraKeys.length, 0)
    };

    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  /**
   * Main validation function
   */
  async validate() {
    try {
      // Load master file
      const masterData = this.loadLanguageFile(this.masterFile);
      const masterKeys = this.extractKeys(masterData);
      
      console.log(`🔍 Validating translations against master: ${this.masterFile}`);
      console.log(`📋 Master file contains ${masterKeys.length} keys`);

      // Find all language files (exclude master)
      const languageFiles = fs.readdirSync(this.localesDir)
        .filter(file => file.endsWith('.json') && file !== this.masterFile);

      if (languageFiles.length === 0) {
        console.log('📝 No additional language files found. Creating placeholder...');
        return { masterKeyCount: masterKeys.length, languages: [] };
      }

      console.log(`🌍 Found ${languageFiles.length} language file(s): ${languageFiles.join(', ')}`);

      // Validate each language file
      const results = {
        masterKeyCount: masterKeys.length,
        languages: []
      };

      for (const langFile of languageFiles) {
        console.log(`\n🔄 Validating ${langFile}...`);
        
        try {
          const langData = this.loadLanguageFile(langFile);
          const langKeys = this.extractKeys(langData);
          const comparison = this.compareKeys(masterKeys, langKeys, langFile);
          
          results.languages.push(comparison);
          
          // Log immediate status
          if (comparison.isComplete) {
            console.log(`✅ ${langFile}: Perfect sync`);
          } else {
            const issues = comparison.missingKeys.length + comparison.extraKeys.length;
            console.log(`⚠️  ${langFile}: ${issues} issue(s) found (${comparison.coverage}% coverage)`);
          }
          
        } catch (error) {
          console.error(`❌ Error validating ${langFile}: ${error.message}`);
          process.exit(1);
        }
      }

      return results;
      
    } catch (error) {
      console.error(`❌ Validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Run validation and determine exit code
   */
  async run() {
    const results = await this.validate();
    
    // Generate report
    this.generateValidationReport(results);
    
    // Save JSON report if requested
    if (this.generateReport) {
      this.saveJsonReport(results);
    }

    // Determine exit code based on mode and results
    const hasIssues = results.languages.some(lang => 
      lang.missingKeys.length > 0 || lang.extraKeys.length > 0);

    if (!hasIssues) {
      console.log('\n🎉 All translations validated successfully!');
      return 0;
    }

    if (this.allowMissing) {
      console.log('\n✅ Validation complete (missing keys allowed in current mode)');
      return 0;
    }

    if (this.warnOnly) {
      console.log('\n⚠️  Validation complete with warnings');
      return 0;
    }

    console.log('\n❌ Validation failed due to translation inconsistencies');
    console.log('💡 Use --allow-missing flag for initial development phase');
    return 1;
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  
  const options = {
    strict: args.includes('--strict'),
    warnOnly: args.includes('--warn-only'),
    allowMissing: args.includes('--allow-missing'),
    generateReport: args.includes('--report')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Translation Validation Tool

Usage: node validate-translations.js [options]

Options:
  --strict        Fail on any missing or extra keys (default)
  --warn-only     Show warnings but don't fail
  --allow-missing Allow missing keys (for development phase)
  --report        Generate JSON report file
  -h, --help      Show this help message

Examples:
  npm run i18n:validate                    # Default strict mode
  npm run i18n:validate -- --allow-missing # Development mode
  npm run i18n:validate -- --warn-only    # Warnings only
  npm run i18n:validate -- --report       # Generate report
`);
    process.exit(0);
  }

  const validator = new TranslationValidator(options);
  validator.run().then(exitCode => {
    process.exit(exitCode);
  });
}

if (require.main === module) {
  main();
}

module.exports = TranslationValidator;