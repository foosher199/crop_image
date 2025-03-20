// Import language files
import en from './en.js';
import zh from './zh.js';

// Available languages
const languages = {
  en,
  zh
};

// Default language
let currentLanguage = 'en';

// Get browser language
function getBrowserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage;
  const shortLang = browserLang.split('-')[0]; // Get the language code (e.g., 'en' from 'en-US')
  
  // Check if the browser language is supported, otherwise default to English
  return languages[shortLang] ? shortLang : 'en';
}

// Initialize i18n
function init() {
  // Get language from localStorage if it exists
  const savedLang = localStorage.getItem('language');
  
  // If no saved language, use browser language
  if (!savedLang) {
    currentLanguage = getBrowserLanguage();
    localStorage.setItem('language', currentLanguage);
  } else {
    currentLanguage = savedLang;
  }
  
  // Set the html lang attribute
  document.documentElement.lang = currentLanguage;
  
  // Apply the translations
  applyTranslations();
  
  // Update the language selector
  updateLanguageSelector();
}

// Change language
function setLanguage(lang) {
  if (languages[lang]) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
    applyTranslations();
    updateLanguageSelector();
    return true;
  }
  return false;
}

// Get current language
function getCurrentLanguage() {
  return currentLanguage;
}

// Get translation for a key
function translate(key) {
  const translations = languages[currentLanguage];
  return translations[key] || languages['en'][key] || key;
}

// Apply all translations to the page
function applyTranslations() {
  // Update document title
  document.title = translate('pageTitle');
  
  // Update all elements with data-i18n attribute
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    
    // Special case for placeholder attributes
    if (element.hasAttribute('placeholder')) {
      element.setAttribute('placeholder', translate(key));
    } 
    // Special case for title attributes (tooltips)
    else if (element.hasAttribute('title')) {
      element.setAttribute('title', translate(key));
    }
    // Default case - inner text
    else {
      element.textContent = translate(key);
    }
  });
}

// Update the language selector to show the current language
function updateLanguageSelector() {
  const languageSelector = document.getElementById('language-selector');
  if (languageSelector) {
    languageSelector.value = currentLanguage;
  }
}

// Export the i18n functionality
export default {
  init,
  setLanguage,
  getCurrentLanguage,
  translate,
  applyTranslations
}; 