import { createInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

// Create i18n instance
const i18n = createInstance();

// Auto-detect available languages by scanning the locales directory structure
const detectAvailableLanguages = async () => {
  try {
    // Fetch the backend's detected languages from our API
    const response = await fetch("/api/i18n/languages");
    if (response.ok) {
      const data = await response.json();
      console.log("Frontend using backend-detected locales:", data.languages);
      return data.languages;
    }
  } catch {
    // Fallback to directory scanning if API not available
  }

  // Fallback: If API is unavailable, return empty array and let i18next handle defaults
  console.log("API unavailable, using i18next defaults");
  return [];
};

// Initialize i18n with detected languages
const initializeI18n = async () => {
  const supportedLanguages = await detectAvailableLanguages();
  const fallbackLanguage =
    supportedLanguages.length > 0 ? supportedLanguages[0] : undefined;

  const i18nInstance = i18n
    // Load translation using http backend
    .use(HttpBackend)
    // Detect user language
    .use(LanguageDetector)
    // Pass the i18n instance to react-i18next
    .use(initReactI18next);

  await i18nInstance.init({
    // Fallback language
    fallbackLng: fallbackLanguage,

    // Dynamically detected supported languages
    supportedLngs: supportedLanguages,

    // Debug mode for development
    debug: import.meta.env.NODE_ENV === "development",

    // Language detection options
    detection: {
      // Order of language detection methods
      order: ["localStorage", "navigator", "htmlTag"],
      // Cache user language
      caches: ["localStorage"],
      // Key for localStorage
      lookupLocalStorage: "i18nextLng",
    },

    // Backend configuration
    backend: {
      // Translation file path pattern
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },

    // Namespaces
    ns: ["common", "auth"],
    defaultNS: "common",

    // Interpolation options
    interpolation: {
      // React already does escaping
      escapeValue: false,
    },

    // React options
    react: {
      // Use Suspense for translations loading
      useSuspense: true,
    },
  });

  return { supportedLanguages, fallbackLanguage };
};

// Export function to get supported languages
export const getSupportedLanguages = () => i18n.options?.supportedLngs || [];

// Initialize the i18n system
initializeI18n().catch((error) => {
  console.error("Failed to initialize i18n:", error);
});

export default i18n;
