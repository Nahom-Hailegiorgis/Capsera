// translate.js - Enhanced translation module with Indian languages
class Translator {
  constructor() {
    this.currentLanguage = 'en';
    this.translations = {};
    this.supportedLanguages = {
      'en': 'English',
      'hi': 'हिंदी (Hindi)', 
      'bn': 'বাংলা (Bengali)',
      'te': 'తెలుగు (Telugu)',
      'mr': 'मराठी (Marathi)',
      'ta': 'தமிழ் (Tamil)',
      'gu': 'ગુજરાતી (Gujarati)',
      'ur': 'اردو (Urdu)',
      'ml': 'മലയാളം (Malayalam)'
    };
    
    this.baseTranslations = {
      'en': {
        'Ideas': 'Ideas',
        'My Submissions': 'My Submissions',
        'Submit Ideas': 'Submit Ideas', 
        'Settings': 'Settings',
        'Loading...': 'Loading...',
        'Required': 'Required',
        'Submit': 'Submit Idea',
        'Choose language': 'Choose Language',
        'Hey': 'Hey',
        'Draft': 'Draft',
        'Final': 'Final',
        'Submitted': 'Submitted',
        'Processing': 'Processing',
        'Select User': 'Select User',
        'Select Project': 'Select Project',
        'Ideal Customer Profile': 'Ideal Customer Profile',
        'Product Idea': 'Product Idea',
        'Pain Points': 'Pain Points',
        'Alternatives': 'Alternatives',
        'Categories': 'Categories',
        'How did you hear about Capsera?': 'How did you hear about Capsera?',
        'Optional': 'Optional',
        'Hold CTRL to select multiple categories!': 'Hold CTRL to select multiple categories!',
        'Describe who would use your product...': 'Describe who would use your product...',
        'Explain your product idea...': 'Explain your product idea...',
        'What problems does this solve?': 'What problems does this solve?',
        'What similar solutions exist?': 'What similar solutions exist?',
        'Select...': 'Select...'
      }
    };
  }

  async init() {
    // Load saved language preference
    const saved = localStorage.getItem('capsera_language');
    if (saved && this.supportedLanguages[saved]) {
      this.currentLanguage = saved;
    }

    // Load base translations
    this.translations = { ...this.baseTranslations };
    
    // If not English, attempt to translate
    if (this.currentLanguage !== 'en') {
      await this.loadTranslations(this.currentLanguage);
    }

    return this.translations;
  }

  async loadTranslations(langCode) {
    if (langCode === 'en') {
      this.translations[langCode] = this.baseTranslations.en;
      return;
    }

    try {
      const textsToTranslate = Object.values(this.baseTranslations.en);
      const translatedTexts = await this.translateBatch(textsToTranslate, langCode);
      
      // Create translation mapping
      const keys = Object.keys(this.baseTranslations.en);
      const translations = {};
      
      keys.forEach((key, index) => {
        translations[key] = translatedTexts[index] || this.baseTranslations.en[key];
      });
      
      this.translations[langCode] = translations;
      
    } catch (error) {
      console.warn('Translation loading failed:', error);
      this.translations[langCode] = { ...this.baseTranslations.en };
    }
  }

  async translateBatch(texts, targetLang) {
    const results = [];
    
    // Translate in smaller batches to avoid API limits
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const batchResults = await Promise.all(
          batch.map(text => this.translateSingle(text, targetLang))
        );
        results.push(...batchResults);
      } catch (error) {
        console.warn('Batch translation failed:', error);
        // Fallback to original texts for failed batch
        results.push(...batch);
      }
      
      // Small delay between batches to be API-friendly
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  async translateSingle(text, targetLang) {
    if (!text || text.length < 2) return text;
    
    try {
      const response = await fetch('/.netlify/functions/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          targetLang: targetLang,
          sourceLang: 'en'
        })
      });

      const data = await response.json();
      
      if (data.success && data.translatedText) {
        return data.translatedText;
      } else {
        console.warn('Translation API returned no result for:', text);
        return text; // Fallback to original
      }
      
    } catch (error) {
      console.warn('Single translation failed:', text, error);
      return text; // Fallback to original
    }
  }

  async changeLanguage(langCode) {
    if (!this.supportedLanguages[langCode]) return false;
    
    this.currentLanguage = langCode;
    localStorage.setItem('capsera_language', langCode);
    
    if (!this.translations[langCode]) {
      await this.loadTranslations(langCode);
    }
    
    this.updateUI();
    return true;
  }

  updateUI() {
    const elements = document.querySelectorAll('[data-ui-key]');
    const currentTranslations = this.translations[this.currentLanguage] || this.baseTranslations.en;
    
    elements.forEach(element => {
      const key = element.getAttribute('data-ui-key');
      const translation = currentTranslations[key];
      
      if (translation) {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          if (element.placeholder) {
            element.placeholder = translation;
          }
        } else {
          element.textContent = translation;
        }
      }
    });

    // Update placeholders
    this.updatePlaceholders();
    
    // Update select options if needed
    this.updateSelectOptions();
  }

  updatePlaceholders() {
    const currentTranslations = this.translations[this.currentLanguage] || this.baseTranslations.en;
    
    // Update specific placeholders
    const placeholders = [
      { selector: '#ideal_customer_profile', key: 'Describe who would use your product...' },
      { selector: '#product_idea', key: 'Explain your product idea...' },
      { selector: '#pain_points', key: 'What problems does this solve?' },
      { selector: '#alternatives', key: 'What similar solutions exist?' }
    ];
    
    placeholders.forEach(({ selector, key }) => {
      const element = document.querySelector(selector);
      if (element && currentTranslations[key]) {
        element.placeholder = currentTranslations[key];
      }
    });
  }

  updateSelectOptions() {
    const currentTranslations = this.translations[this.currentLanguage] || this.baseTranslations.en;
    
    // Update heard_about select
    const heardAboutSelect = document.querySelector('#heard_about');
    if (heardAboutSelect) {
      const firstOption = heardAboutSelect.querySelector('option[value=""]');
      if (firstOption && currentTranslations['Select...']) {
        firstOption.textContent = currentTranslations['Select...'];
      }
    }
  }

  t(key) {
    const currentTranslations = this.translations[this.currentLanguage] || this.baseTranslations.en;
    return currentTranslations[key] || key;
  }

  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }
}

// Create global translator instance
const translator = new Translator();

export { translator };
