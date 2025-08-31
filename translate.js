// translate.js - Enhanced Google Translate integration with Indian languages
import { dbHelper } from "./db.js";

export const translator = {
  supportedLangs: ["en", "hi", "bn", "te", "mr", "ta", "gu", "ur", "ml"],

  // Comprehensive translations object covering ALL user-facing strings
  allStrings: {
    // Navigation and main screens
    Ideas: "Ideas",
    "My Submissions": "My Submissions",
    "Submit Ideas": "Submit Ideas",
    Settings: "Settings",

    // Form elements and actions
    Submit: "Submit",
    "Submit Feedback": "Submit Feedback",
    "Submit Draft 1": "Submit Draft 1",
    "Submit Draft 2": "Submit Draft 2",
    "Submit Final": "Submit Final",
    "Create New User": "Create New User",
    "Create New Project": "Create New Project",
    "Select User": "Select User",
    "Select Project": "Select Project",
    Apply: "Apply",
    Close: "Close",
    Delete: "Delete",

    // Status and loading messages
    "Loading...": "Loading...",
    "Loading ideas...": "Loading ideas...",
    "Loading submissions...": "Loading submissions...",
    "Loading details...": "Loading details...",
    "Updating language...": "Updating language...",
    "No ideas found": "No ideas found",
    "No submissions yet": "No submissions yet",

    // Labels and field names
    "Word count": "Word count",
    Required: "Required",
    Optional: "Optional",
    "Choose language": "Choose language",
    "Choose Language": "Choose Language",
    "Idea Details": "Idea Details",
    "Customer Profile": "Customer Profile",
    "Product Idea": "Product Idea",
    "Pain Points": "Pain Points",
    Alternatives: "Alternatives",
    Categories: "Categories",
    Category: "Category",
    "Quality Score": "Quality Score",
    "AI Feedback": "AI Feedback",
    "AI Analysis": "AI Analysis",

    // Feedback form
    "Share Your Feedback": "Share Your Feedback",
    "How can we improve Capsera?": "How can we improve Capsera?",
    "Tell us what you think...": "Tell us what you think...",
    "Contact (Optional)": "Contact (Optional)",
    "Email or phone (optional)": "Email or phone (optional)",

    // User management
    "Enter your full name:": "Enter your full name:",
    "Create a 4-digit PIN for this account:": "Create a 4-digit PIN for this account:",
    "Enter your 4-digit PIN:": "Enter your 4-digit PIN:",
    "Enter project name:": "Enter project name:",
    "Enter 4-digit PIN to delete user:": "Enter 4-digit PIN to delete user:",
    "Who are you?": "Who are you?",
    "Which project?": "Which project?",
    "What's your full name?": "What's your full name?",
    "Create a 4-digit PIN:": "Create a 4-digit PIN:",
    "Enter your PIN:": "Enter your PIN:",

    // Submission form fields
    "Target Customer Profile": "Target Customer Profile",
    "Describe your ideal customer": "Describe your ideal customer",
    "Your Product Idea": "Your Product Idea",
    "Describe your product or service": "Describe your product or service",
    "What problems does this solve?": "What problems does this solve?",
    "Existing Alternatives": "Existing Alternatives",
    "What similar solutions exist?": "What similar solutions exist?",
    "How did you hear about us?": "How did you hear about us?",
    "How did you find us?": "How did you find us?",

    // New comprehensive form labels from index.html
    "Who would love this?": "Who would love this?",
    "What's your solution?": "What's your solution?",
    "What alternatives exist?": "What alternatives exist?",
    "Hold CTRL to select multiple": "Hold CTRL to select multiple",

    // Placeholders and hints
    "Describe your target customers - their age, job, daily problems they face...": "Describe your target customers - their age, job, daily problems they face...",
    "Explain your product idea clearly - what does it do and how does it help people?": "Explain your product idea clearly - what does it do and how does it help people?",
    "What specific problems or frustrations do your target customers experience?": "What specific problems or frustrations do your target customers experience?",
    "What similar products or solutions already exist? How is yours different?": "What similar products or solutions already exist? How is yours different?",
    "Select...": "Select...",

    // Draft 2 content
    "Let's talk market research": "Let's talk market research",
    "Time to validate your idea with real data!": "Time to validate your idea with real data!",
    "Did you talk to potential customers?": "Did you talk to potential customers?",
    "How deep did you research competitors?": "How deep did you research competitors?",
    "Did you build an MVP or prototype?": "Did you build an MVP or prototype?",
    "Got photos of your product?": "Got photos of your product?",
    "Optional for physical products": "Optional for physical products",
    "Upload a photo if you have a physical prototype or mockup": "Upload a photo if you have a physical prototype or mockup",

    // Draft 3 content
    "Final pitch time!": "Final pitch time!",
    "Show us you're ready to make this happen": "Show us you're ready to make this happen",
    "Your investor pitch": "Your investor pitch",
    "What research have you done since last time?": "What research have you done since last time?",
    "MVP or demo link": "MVP or demo link",
    "Share a link to your working prototype, demo, or landing page": "Share a link to your working prototype, demo, or landing page",

    // AI Feedback categories
    "Problem Significance": "Problem Significance",
    "Target Audience": "Target Audience",
    Uniqueness: "Uniqueness",
    Feasibility: "Feasibility",
    Scalability: "Scalability",
    Competition: "Competition",
    "Business Viability": "Business Viability",
    "Adoption Potential": "Adoption Potential",
    "Risk Assessment": "Risk Assessment",
    "Impact Potential": "Impact Potential",

    // Status messages
    Draft: "Draft",
    "Final Submission": "Final Submission",
    "Projects Summary": "Projects Summary",
    "All Submissions": "All Submissions",
    attempts: "attempts",
    attempt: "attempt",
    "Last updated": "Last updated",

    // Validation and error messages
    "Please select or create a user first": "Please select or create a user first",
    "Please select or create a project": "Please select or create a project",
    "Please enter your feedback message": "Please enter your feedback message",
    "PIN must be exactly 4 digits": "PIN must be exactly 4 digits",
    "Invalid PIN": "Invalid PIN",
    "User deleted": "User deleted",
    "Failed to delete user": "Failed to delete user",
    "User created": "User created",
    "Project created": "Project created",
    "Switched to": "Switched to",
    "Language updated successfully": "Language updated successfully",
    "Failed to update language": "Failed to update language",
    "Thank you for your feedback!": "Thank you for your feedback!",
    "Failed to submit feedback. Please try again.": "Failed to submit feedback. Please try again.",

    // Greeting messages
    "Hey there! Ready to share your idea?": "Hey there! Ready to share your idea?",
    "We rate ideas kindly — see tips below for better scores!": "We rate ideas kindly — see tips below for better scores!",
    "Research Time!": "Research Time!",
    "Please conduct customer interviews and market research.": "Please conduct customer interviews and market research.",
    "Next submission available in:": "Next submission available in:",
    "days": "days",
    "Suggested activities:": "Suggested activities:",
    "Interview 5-10 potential customers": "Interview 5-10 potential customers",
    "Research existing competitors thoroughly": "Research existing competitors thoroughly",
    "Create a basic prototype or mockup": "Create a basic prototype or mockup",

    // Category options
    Technology: "Technology",
    Healthcare: "Healthcare",
    Education: "Education",
    Finance: "Finance",
    Entertainment: "Entertainment",
    "Food & Beverage": "Food & Beverage",
    Transportation: "Transportation",
    Communication: "Communication",
    Productivity: "Productivity",
    "Social Impact": "Social Impact",
    "E-commerce": "E-commerce",
    Gaming: "Gaming",
    Travel: "Travel",
    "Fitness & Wellness": "Fitness & Wellness",
    Environment: "Environment",
    Other: "Other",

    // Heard about options
    "Social Media": "Social Media",
    "Friend/Family": "Friend/Family",
    "Search Engine": "Search Engine",
    "News/Blog": "News/Blog",
    Advertisement: "Advertisement",
    "Event/Conference": "Event/Conference",

    // Tooltips and help text
    "Think specific! Instead of \"everyone\", describe who would use this daily - their demographics, pain points, and current behavior.": "Think specific! Instead of \"everyone\", describe who would use this daily - their demographics, pain points, and current behavior.",
    "Focus on the value! Explain what your product does and why people would choose it over existing options.": "Focus on the value! Explain what your product does and why people would choose it over existing options.",
    "Be specific about the pain! Describe real problems that keep your customers up at night or waste their time.": "Be specific about the pain! Describe real problems that keep your customers up at night or waste their time.",
    "Know your competition! List existing solutions and explain why yours is better or different.": "Know your competition! List existing solutions and explain why yours is better or different.",

    // Word count indicators
    "words": "words",
    "0 words": "0 words",

    // Connection status
    "Connection restored": "Connection restored",
    "Working offline": "Working offline",

    // Modal and UI elements
    "Detailed view coming soon!": "Detailed view coming soon!",
    "Detailed view is not available at this time.": "Detailed view is not available at this time.",
    Users: "Users"
  },

  // Legacy tooltips for backward compatibility
  defaultTooltips: {
    ideal_customer_profile: "Describe who would use your product - their age, job, problems they face, etc.",
    product_idea: "Explain your product idea clearly - what does it do and how does it help people?",
    pain_points: "What specific problems or frustrations does your target customer experience?",
    alternatives: "What similar products or solutions already exist? How is yours different?",
    category: "Choose the category that best fits your product idea",
    heard_about: "How did you discover Capsera? This helps us understand our audience better",
  },

  // Enhanced translation fetching with comprehensive coverage
  async getTranslations(targetLang) {
    if (targetLang === "en") {
      return {
        tooltips: this.defaultTooltips,
        ui: this.allStrings,
      };
    }

    // Check cache first
    const cached = await dbHelper.getCachedTranslations(targetLang);
    if (cached && cached.ui && cached.tooltips && Object.keys(cached.ui).length > 50) {
      console.log(`🌐 Using cached translations for ${targetLang} (${Object.keys(cached.ui).length} strings)`);
      return cached;
    }

    console.log(`🌐 Fetching fresh translations for ${targetLang}...`);

    try {
      const translations = {
        tooltips: {},
        ui: {},
      };

      // Translate tooltips first (smaller batch)
      const tooltipEntries = Object.entries(this.defaultTooltips);
      for (let i = 0; i < tooltipEntries.length; i++) {
        const [key, text] = tooltipEntries[i];
        const translated = await this.translateText(text, targetLang);
        translations.tooltips[key] = translated;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Translate all UI strings (comprehensive set)
      const uiEntries = Object.entries(this.allStrings);
      const batchSize = 8; // Smaller batches for reliability

      for (let i = 0; i < uiEntries.length; i += batchSize) {
        const batch = uiEntries.slice(i, i + batchSize);

        // Translate batch in parallel
        const batchPromises = batch.map(async ([key, text]) => {
          const translated = await this.translateText(text, targetLang);
          return [key, translated];
        });

        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const [key, translated] = result.value;
            translations.ui[key] = translated;
          } else {
            // Fallback to English if translation fails
            const [key, originalText] = batch[index];
            translations.ui[key] = originalText;
            console.warn(`🌐 Translation failed for "${key}", using English fallback`);
          }
        });

        // Progress indicator and delay
        console.log(`🌐 Translation progress: ${Math.min(i + batchSize, uiEntries.length)}/${uiEntries.length} UI strings`);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Cache the translations
      await dbHelper.cacheTranslations(targetLang, translations);
      console.log(`🌐 Translations for ${targetLang} cached successfully (${Object.keys(translations.ui).length} strings)`);

      return translations;
    } catch (error) {
      console.error("Translation failed:", error);
      // Return English as fallback
      return {
        tooltips: this.defaultTooltips,
        ui: this.allStrings,
      };
    }
  },

  // Updated translate single text with better error handling
  async translateText(text, targetLang, retries = 2) {
    // Skip translation for very short or non-translatable content
    if (!text || text.length < 2 || /^[0-9\s\-_:/.]+$/.test(text)) {
      return text;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`🌐 Translating: "${text.substring(0, 30)}..." to ${targetLang}`);
        
        const response = await fetch('/.netlify/functions/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            targetLang: targetLang,
            sourceLang: 'en'
          })
        });

        if (!response.ok) {
          throw new Error(`Netlify function error: ${response.status} - ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success && result.translatedText) {
          console.log(`🌐 Translation successful: "${result.translatedText.substring(0, 30)}..."`);
          return result.translatedText;
        }
        
        if (!result.success) {
          console.warn(`🌐 Translation failed: ${result.error || 'Unknown error'}`);
          return text; // Return original text
        }

        return text;

      } catch (error) {
        console.error(`🌐 Translation attempt ${attempt + 1} failed:`, error);

        if (attempt === retries) {
          console.warn(`🌐 All translation attempts failed for "${text}", using English fallback`);
          return text;
        }

        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return text;
  },

  // Enhanced UI translation with fallback mechanism
  applyTranslations(translations) {
    // Update tooltip texts
    document.querySelectorAll("[data-tooltip-key]").forEach((element) => {
      const key = element.getAttribute("data-tooltip-key");
      if (translations.tooltips[key]) {
        const tooltip = element.querySelector(".tooltip-text");
        if (tooltip) {
          tooltip.style.opacity = "0";
          setTimeout(() => {
            tooltip.textContent = translations.tooltips[key];
            tooltip.style.opacity = "1";
          }, 150);
        }
      }
    });

    // Update UI strings with fallback
    document.querySelectorAll("[data-ui-key]").forEach((element) => {
      const key = element.getAttribute("data-ui-key");
      const translatedText = translations.ui[key];
      
      if (translatedText) {
        this.updateElementText(element, translatedText);
      } else {
        // Fallback to English and log warning
        const englishText = this.allStrings[key];
        if (englishText) {
          console.warn(`🌐 Missing translation for "${key}", using English fallback`);
          this.updateElementText(element, englishText);
        } else {
          console.error(`🌐 Missing translation key "${key}" in both current language and English`);
        }
      }
    });

    // Update dynamic content
    this.updateDynamicContent(translations);
    
    // Update all text content that might not have data attributes
    this.updateAllTextContent(translations);
  },

  updateElementText(element, text) {
    const originalTransition = element.style.transition;
    element.style.transition = "opacity 0.2s ease";
    element.style.opacity = "0.7";

    setTimeout(() => {
      if (element.tagName === "INPUT") {
        if (element.type === "submit" || element.type === "button") {
          element.value = text;
        } else if (element.placeholder) {
          element.placeholder = text;
        }
      } else if (element.tagName === "OPTION") {
        element.textContent = text;
      } else {
        element.textContent = text;
      }

      element.style.opacity = "1";
      element.style.transition = originalTransition;
    }, 200);
  },

  // Update all possible text content
  updateAllTextContent(translations) {
    // Update buttons without data attributes
    document.querySelectorAll('button').forEach(button => {
      const text = button.textContent.trim();
      if (translations.ui[text]) {
        button.textContent = translations.ui[text];
      }
    });

    // Update labels without data attributes
    document.querySelectorAll('label').forEach(label => {
      const text = label.textContent.trim().replace(/\s*\*$/, ''); // Remove asterisk
      if (translations.ui[text]) {
        const hasAsterisk = label.textContent.includes('*');
        label.textContent = translations.ui[text] + (hasAsterisk ? ' *' : '');
      }
    });

    // Update headings
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
      const text = heading.textContent.trim();
      if (translations.ui[text]) {
        heading.textContent = translations.ui[text];
      }
    });

    // Update placeholder texts
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(input => {
      const placeholder = input.placeholder;
      if (translations.ui[placeholder]) {
        input.placeholder = translations.ui[placeholder];
      }
    });

    // Update select options
    document.querySelectorAll('option').forEach(option => {
      const text = option.textContent.trim();
      if (translations.ui[text]) {
        option.textContent = translations.ui[text];
      }
    });
  },

  // Update content that might not have data attributes
  updateDynamicContent(translations) {
    // Update common patterns
    const selectors = {
      '.loading': ['Loading...', 'Loading ideas...', 'Loading submissions...', 'Loading details...'],
      '.error': ['Failed to load ideas', 'Failed to load idea details'],
      '.text-center': ['No ideas found', 'No submissions yet', 'No users found'],
      '.word-counter': (element) => {
        const text = element.textContent;
        // Handle word count format like "5 words (10-200)"
        const match = text.match(/(\d+)\s*words?\s*\((\d+-\d+)\)/);
        if (match) {
          const [, count, range] = match;
          const wordsText = translations.ui['words'] || 'words';
          element.textContent = `${count} ${wordsText} (${range})`;
        }
      }
    };

    Object.entries(selectors).forEach(([selector, handler]) => {
      document.querySelectorAll(selector).forEach(element => {
        if (typeof handler === 'function') {
          handler(element);
        } else {
          const text = element.textContent.trim();
          const translation = handler.find(key => translations.ui[key] && text.includes(key));
          if (translation) {
            element.textContent = element.textContent.replace(translation, translations.ui[translation]);
          }
        }
      });
    });
  },

  // Language code to name mapping for Indian languages
  getLanguageName(code) {
    const names = {
      en: "English",
      hi: "हिन्दी (Hindi)",
      bn: "বাংলা (Bengali)",
      te: "తెలుగు (Telugu)", 
      mr: "मराठी (Marathi)",
      ta: "தமிழ் (Tamil)",
      gu: "ગુજરાતી (Gujarati)",
      ur: "اردو (Urdu)",
      ml: "മലയാളം (Malayalam)",
    };
    return names[code] || code;
  },

  // Get current language from localStorage with fallback
  getCurrentLanguage() {
    try {
      const stored = localStorage.getItem("capsera_language");
      return stored && this.supportedLangs.includes(stored) ? stored : "en";
    } catch (error) {
      console.warn("localStorage not available, using default language");
      return "en";
    }
  },

  // Set current language with validation
  setCurrentLanguage(lang) {
    if (this.supportedLangs.includes(lang)) {
      try {
        localStorage.setItem("capsera_language", lang);
        console.log(`🌐 Language set to: ${lang}`);
        return true;
      } catch (error) {
        console.warn("localStorage not available for setting language");
        return false;
      }
    }
    console.warn(`🌐 Unsupported language: ${lang}`);
    return false;
  },

  // Initialize translations with enhanced loading
  async init() {
    console.log("🌐 Initializing translator with comprehensive string coverage...");

    const currentLang = this.getCurrentLanguage();
    console.log(`🌐 Current language: ${currentLang}`);

    if (currentLang === "en") {
      const translations = {
        tooltips: this.defaultTooltips,
        ui: this.allStrings,
      };
      this.applyTranslations(translations);
      return translations;
    }

    // Show loading indicator for non-English languages
    const loadingIndicator = document.createElement("div");
    loadingIndicator.className = "translation-loading";
    loadingIndicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-size: 1.2rem;
      color: #0f2e4d;
    `;
    loadingIndicator.innerHTML = `
      <div style="text-align: center;">
        <div style="margin-bottom: 1rem;">🌐</div>
        <div>Loading translations...</div>
        <div style="font-size: 0.9rem; margin-top: 0.5rem;">
          ${this.getLanguageName(currentLang)}
        </div>
      </div>
    `;

    document.body.appendChild(loadingIndicator);

    try {
      const translations = await this.getTranslations(currentLang);
      this.applyTranslations(translations);
      console.log(`🌐 Translation complete for ${currentLang} (${Object.keys(translations.ui).length} strings)`);
      return translations;
    } finally {
      loadingIndicator.remove();
    }
  },

  // Clear translation cache for updates
  async clearTranslationCache() {
    try {
      for (const lang of this.supportedLangs) {
        if (lang !== "en") {
          await dbHelper.clearCachedTranslations(lang);
        }
      }
      console.log("🌐 Translation cache cleared");
      return true;
    } catch (error) {
      console.error("Failed to clear translation cache:", error);
      return false;
    }
  },

  // Enhanced translation validation
  validateTranslation(original, translated, targetLang) {
    const checks = {
      notEmpty: translated && translated.trim().length > 0,
      notSameAsOriginal: translated !== original || targetLang === 'en',
      reasonableLength: translated.length >= original.length * 0.3 && translated.length <= original.length * 4,
      hasValidChars: /[\w\s]/.test(translated),
      notOnlyPunctuation: !/^[^\w\s]*$/.test(translated)
    };

    const passed = Object.values(checks).every(check => check);

    return {
      valid: passed,
      checks,
      confidence: passed ? 0.85 : 0.2,
    };
  },
};
