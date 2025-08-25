/**
 * Lightweight i18n module for Claude Code Templates
 * Provides basic internationalization functionality without external dependencies
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class I18n {
  constructor(options = {}) {
    this.locale = options.locale || this.detectDefaultLocale();
    this.fallbackLocale = options.fallbackLocale || 'en';
    this.localesDir = options.localesDir || path.join(__dirname, '..', 'locales');
    this.translations = {};
    this.loadedLocales = new Set();
    
    // Load initial locale
    this.loadLocale(this.locale);
    
    // Load fallback if different from current locale
    if (this.locale !== this.fallbackLocale) {
      this.loadLocale(this.fallbackLocale);
    }
  }

  /**
   * Detect system default locale
   */
  detectDefaultLocale() {
    // Check environment variables
    const envLocale = process.env.CLAUDE_LANG || 
                     process.env.LANG || 
                     process.env.LANGUAGE || 
                     process.env.LC_ALL;
    
    if (envLocale) {
      // Extract language code (e.g., 'ja_JP.UTF-8' -> 'ja')
      const langCode = envLocale.split(/[_.-]/)[0].toLowerCase();
      return langCode;
    }

    // Use OS locale as fallback
    try {
      const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
      return systemLocale.split('-')[0].toLowerCase();
    } catch (error) {
      return 'en'; // Final fallback
    }
  }

  /**
   * Load translations for a specific locale
   */
  loadLocale(locale) {
    if (this.loadedLocales.has(locale)) {
      return true;
    }

    const localeFile = path.join(this.localesDir, `${locale}.json`);
    
    if (!fs.existsSync(localeFile)) {
      if (locale !== this.fallbackLocale) {
        console.warn(`[i18n] Locale file not found: ${locale}.json, falling back to ${this.fallbackLocale}`);
        return false;
      }
      throw new Error(`Fallback locale file not found: ${localeFile}`);
    }

    try {
      const content = fs.readFileSync(localeFile, 'utf8');
      const translations = JSON.parse(content);
      
      this.translations[locale] = translations;
      this.loadedLocales.add(locale);
      return true;
    } catch (error) {
      throw new Error(`Failed to load locale ${locale}: ${error.message}`);
    }
  }

  /**
   * Get translation for a key with parameter substitution
   */
  t(key, params = {}, locale = null) {
    const targetLocale = locale || this.locale;
    
    // Try to get translation from target locale
    let translation = this.getNestedValue(this.translations[targetLocale], key);
    
    // Fallback to fallback locale if not found
    if (translation === undefined && targetLocale !== this.fallbackLocale) {
      translation = this.getNestedValue(this.translations[this.fallbackLocale], key);
    }
    
    // Ultimate fallback: return the key itself
    if (translation === undefined) {
      console.warn(`[i18n] Translation missing for key: ${key}`);
      return key;
    }

    // Parameter substitution
    if (typeof translation === 'string' && Object.keys(params).length > 0) {
      return this.interpolate(translation, params);
    }

    return translation;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, key) {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    return key.split('.').reduce((current, segment) => {
      return current && current[segment] !== undefined ? current[segment] : undefined;
    }, obj);
  }

  /**
   * Interpolate parameters into translation string
   */
  interpolate(template, params) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * Set current locale
   */
  setLanguage(locale) {
    if (locale === this.locale) {
      return true;
    }

    // Try to load the new locale
    const loaded = this.loadLocale(locale);
    if (loaded || locale === this.fallbackLocale) {
      this.locale = locale;
      return true;
    }

    console.warn(`[i18n] Failed to set language to ${locale}, keeping current: ${this.locale}`);
    return false;
  }

  /**
   * Get current locale
   */
  getLanguage() {
    return this.locale;
  }

  /**
   * Get list of available locales
   */
  getAvailableLanguages() {
    try {
      const files = fs.readdirSync(this.localesDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'))
        .sort();
    } catch (error) {
      console.warn(`[i18n] Failed to read locales directory: ${error.message}`);
      return [this.fallbackLocale];
    }
  }

  /**
   * Check if a locale is available
   */
  isLocaleAvailable(locale) {
    return this.getAvailableLanguages().includes(locale);
  }

  /**
   * Get locale metadata
   */
  getLocaleInfo(locale = null) {
    const targetLocale = locale || this.locale;
    const translations = this.translations[targetLocale];
    
    if (!translations) {
      return null;
    }

    return {
      locale: targetLocale,
      name: translations._meta?.name || targetLocale,
      nativeName: translations._meta?.nativeName || targetLocale,
      direction: translations._meta?.direction || 'ltr',
      completeness: translations._meta?.completeness || null
    };
  }

  /**
   * Reload all translations (useful for development)
   */
  reload() {
    this.translations = {};
    this.loadedLocales.clear();
    
    // Reload current and fallback locales
    this.loadLocale(this.locale);
    if (this.locale !== this.fallbackLocale) {
      this.loadLocale(this.fallbackLocale);
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create i18n instance
 */
function getI18n(options = {}) {
  if (!instance) {
    instance = new I18n(options);
  }
  return instance;
}

/**
 * Initialize i18n with options
 */
function init(options = {}) {
  instance = new I18n(options);
  return instance;
}

/**
 * Shorthand translation function
 */
function t(key, params = {}) {
  const i18n = getI18n();
  return i18n.t(key, params);
}

/**
 * Set language globally
 */
function setLanguage(locale) {
  const i18n = getI18n();
  return i18n.setLanguage(locale);
}

/**
 * Get current language
 */
function getLanguage() {
  const i18n = getI18n();
  return i18n.getLanguage();
}

/**
 * Get available languages
 */
function getAvailableLanguages() {
  const i18n = getI18n();
  return i18n.getAvailableLanguages();
}

/**
 * Parse language from command line arguments
 */
function parseLanguageFromArgs(args = process.argv) {
  const langIndex = args.findIndex(arg => arg === '--lang' || arg === '--language');
  if (langIndex !== -1 && args[langIndex + 1]) {
    return args[langIndex + 1];
  }
  
  // Check for --lang=code format
  const langArg = args.find(arg => arg.startsWith('--lang=') || arg.startsWith('--language='));
  if (langArg) {
    return langArg.split('=')[1];
  }
  
  return null;
}

module.exports = {
  I18n,
  init,
  getI18n,
  t,
  setLanguage,
  getLanguage,
  getAvailableLanguages,
  parseLanguageFromArgs
};