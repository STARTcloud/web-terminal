import i18n from 'i18n';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, existsSync } from 'fs';
import configLoader from './configLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Auto-detect available locales by scanning the locales directory
const getAvailableLocales = () => {
  const localesDir = join(__dirname, 'locales');

  if (!existsSync(localesDir)) {
    console.warn('Locales directory not found, defaulting to English only');
    return ['en'];
  }

  try {
    const files = readdirSync(localesDir);
    const locales = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .filter(locale => locale.length >= 2); // Valid locale codes

    if (locales.length === 0) {
      console.warn('No translation files found, defaulting to English only');
      return ['en'];
    }

    console.log('Auto-detected backend locales:', locales);
    return locales;
  } catch (error) {
    console.error('Error scanning locales directory:', error.message);
    return ['en'];
  }
};

// Auto-generate fallbacks - all languages fall back to first available or 'en'
const generateFallbacks = locales => {
  const fallbacks = {};
  const defaultLocale = locales.includes('en') ? 'en' : locales[0];

  locales.forEach(locale => {
    if (locale !== defaultLocale) {
      fallbacks[locale] = defaultLocale;
    }
  });

  return fallbacks;
};

const availableLocales = getAvailableLocales();
const defaultLocale = availableLocales.includes('en') ? 'en' : availableLocales[0];

// Configure i18n for backend
i18n.configure({
  locales: availableLocales,
  defaultLocale,
  fallbacks: generateFallbacks(availableLocales),
  directory: join(__dirname, 'locales'),
  objectNotation: true,
  updateFiles: false,
  syncFiles: false,
  autoReload: process.env.NODE_ENV === 'development',
  indent: '  ',
  extension: '.json',
  logDebugFn(msg) {
    if (process.env.NODE_ENV === 'development') {
      console.log('i18n debug:', msg);
    }
  },
  logWarnFn(msg) {
    console.warn('i18n warn:', msg);
  },
  logErrorFn(msg) {
    console.error('i18n error:', msg);
  },
});

// Helper function to find the best matching locale
const findBestMatchingLocale = (requestedLocale, supportedLocales) => {
  if (!requestedLocale) {
    return defaultLocale;
  }

  // Direct match
  if (supportedLocales.includes(requestedLocale.toLowerCase())) {
    return requestedLocale.toLowerCase();
  }

  // Language prefix match (e.g., 'en-US' matches 'en')
  const [languagePrefix] = requestedLocale.toLowerCase().split('-');
  const prefixMatch = supportedLocales.find(locale => locale.startsWith(languagePrefix));
  if (prefixMatch) {
    return prefixMatch;
  }

  // Fallback to default
  return defaultLocale;
};

// Export available locales for use in other modules
export const getSupportedLocales = () => availableLocales;
export const getDefaultLocale = () => defaultLocale;

// Create the actual i18n middleware with proper configuration
export const i18nMiddleware = i18n.init;

// Enhanced middleware that adds configuration-driven behavior
export const configAwareI18nMiddleware = (req, res, next) => {
  // First apply the base i18n middleware
  i18nMiddleware(req, res, () => {
    try {
      // Get i18n configuration from config loader
      const i18nConfig = configLoader.getI18nConfig();

      // If force_language is set, use it regardless of user preferences
      if (i18nConfig.force_language) {
        const forcedLocale = findBestMatchingLocale(i18nConfig.force_language, availableLocales);
        req.setLocale(forcedLocale);
        next();
        return;
      }

      // If auto_detect is disabled, use default_language
      if (!i18nConfig.auto_detect) {
        const configuredLocale = findBestMatchingLocale(
          i18nConfig.default_language,
          availableLocales
        );
        req.setLocale(configuredLocale);
        next();
        return;
      }

      // Normal auto-detection: Priority: query param > header > configured default
      let locale = req.query.lang || req.get('Accept-Language') || i18nConfig.default_language;

      if (Array.isArray(locale)) {
        [locale] = locale;
      } else if (typeof locale !== 'string') {
        locale = i18nConfig.default_language;
      }

      // Parse Accept-Language header if present
      if (locale && locale.includes(',')) {
        [locale] = locale.split(',');
      }

      // Find the best matching locale from available locales
      const normalizedLocale = findBestMatchingLocale(locale, availableLocales);

      // Set locale for this request
      req.setLocale(normalizedLocale);
    } catch (error) {
      // Fallback to simple locale detection if config loading fails
      console.warn('Config loading failed in i18n middleware, using fallback:', error.message);
      let locale = req.query.lang || req.get('Accept-Language') || defaultLocale;

      if (Array.isArray(locale)) {
        [locale] = locale;
      } else if (typeof locale !== 'string') {
        locale = defaultLocale;
      }

      if (locale && locale.includes(',')) {
        [locale] = locale.split(',');
      }
      const normalizedLocale = findBestMatchingLocale(locale, availableLocales);
      req.setLocale(normalizedLocale);
    }

    next();
  });
};

// Helper function to get translated message
export const t = (key, locale = 'en', replacements = {}) => {
  const originalLocale = i18n.getLocale();
  i18n.setLocale(locale);
  const message = i18n.__(key, replacements);
  i18n.setLocale(originalLocale);
  return message;
};

export default i18n;
