// translate.js - Enhanced Google Translate integration with Netlify Functions
import { dbHelper } from "./db.js";

export const translator = {
  supportedLangs: ["en", "am", "fr", "sw", "ar"],

  defaultTooltips: {
    ideal_customer_profile:
      "Describe who would use your product - their age, job, problems they face, etc.",
    product_idea:
      "Explain your product idea clearly - what does it do and how does it help people?",
    pain_points:
      "What specific problems or frustrations does your target customer experience?",
    alternatives:
      "What similar products or solutions already exist? How is yours different?",
    category: "Choose the category that best fits your product idea",
    heard_about:
      "How did you discover Capsera? This helps us understand our audience better",
  },

  uiStrings: {
    // Navigation
    Ideas: "Ideas",
    "My Submissions": "My Submissions",
    "Submit Ideas": "Submit Ideas",
    Settings: "Settings",

    // Form elements
    Submit: "Submit",
    "Submit Feedback": "Submit Feedback",
    "Create New User": "Create New User",
    "Create New Project": "Create New Project",
    "Select User": "Select User",
    "Select Project": "Select Project",

    // Status messages
    "Loading...": "Loading...",
    "No ideas found": "No ideas found",
    "No submissions yet": "No submissions yet",
    "Loading ideas...": "Loading ideas...",
    "Loading submissions...": "Loading submissions...",
    "Loading details...": "Loading details...",
    "Updating language...": "Updating language...",

    // Labels and descriptions
    "Word count": "Word count",
    Required: "Required",
    Optional: "Optional",
    "Choose language": "Choose language",
    Apply: "Apply",
    "Idea Details": "Idea Details",
    "Customer Profile": "Customer Profile",
    "Product Idea": "Product Idea",
    "Pain Points": "Pain Points",
    Alternatives: "Alternatives",
    Categories: "Categories",
    "Quality Score": "Quality Score",

    // Feedback form
    "Share Your Feedback": "Share Your Feedback",
    "How can we improve Capsera?": "How can we improve Capsera?",
    "Tell us what you think...": "Tell us what you think...",
    "Contact (Optional)": "Contact (Optional)",
    "Email or phone (optional)": "Email or phone (optional)",

    // User management
    "Enter your full name:": "Enter your full name:",
    "Create a 4-digit PIN for this account:":
      "Create a 4-digit PIN for this account:",
    "Enter your 4-digit PIN:": "Enter your 4-digit PIN:",
    "Enter project name:": "Enter project name:",
    "Enter 4-digit PIN to delete user:": "Enter 4-digit PIN to delete user:",

    // Submission form
    "Target Customer Profile": "Target Customer Profile",
    "Describe your ideal customer": "Describe your ideal customer",
    "Your Product Idea": "Your Product Idea",
    "Describe your product or service": "Describe your product or service",
    "Pain Points": "Pain Points",
    "What problems does this solve?": "What problems does this solve?",
    "Existing Alternatives": "Existing Alternatives",
    "What similar solutions exist?": "What similar solutions exist?",
    Category: "Category",
    "How did you hear about us?": "How did you hear about us?",

    // AI Feedback
    "AI Feedback": "AI Feedback",
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

    // Status and messages
    Draft: "Draft",
    "Final Submission": "Final Submission",
    "Projects Summary": "Projects Summary",
    "All Submissions": "All Submissions",
    attempts: "attempts",
    attempt: "attempt",
    "Last updated": "Last updated",
    Close: "Close",
    Delete: "Delete",

    // Validation messages
    "Please select or create a user first":
      "Please select or create a user first",
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
    "Failed to submit feedback. Please try again.":
      "Failed to submit feedback. Please try again.",
  },

  // Enhanced translation fetching with progress tracking
  async getTranslations(targetLang) {
    if (targetLang === "en") {
      return {
        tooltips: this.defaultTooltips,
        ui: this.uiStrings,
      };
    }

    // Check cache first
    const cached = await dbHelper.getCachedTranslations(targetLang);
    if (cached && cached.ui && cached.tooltips) {
      console.log(`🌐 Using cached translations for ${targetLang}`);
      return cached;
    }

    console.log(`🌐 Fetching fresh translations for ${targetLang}...`);

    try {
      // Translate in batches to avoid rate limits and show progress
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

        // Small delay to respect API limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Translate UI strings (larger batch)
      const uiEntries = Object.entries(this.uiStrings);
      const batchSize = 10;

      for (let i = 0; i < uiEntries.length; i += batchSize) {
        const batch = uiEntries.slice(i, i + batchSize);

        // Translate batch in parallel
        const batchPromises = batch.map(async ([key, text]) => {
          const translated = await this.translateText(text, targetLang);
          return [key, translated];
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(([key, translated]) => {
          translations.ui[key] = translated;
        });

        // Progress indicator and delay
        console.log(
          `🌐 Translation progress: ${Math.min(
            i + batchSize,
            uiEntries.length
          )}/${uiEntries.length} UI strings`
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Cache the translations
      await dbHelper.cacheTranslations(targetLang, translations);
      console.log(`🌐 Translations for ${targetLang} cached successfully`);

      return translations;
    } catch (error) {
      console.error("Translation failed:", error);
      // Return English as fallback
      return {
        tooltips: this.defaultTooltips,
        ui: this.uiStrings,
      };
    }
  },

  // **UPDATED: Translate single text using Netlify Function**
  async translateText(text, targetLang, retries = 2) {
    // Skip translation for very short or non-translatable content
    if (!text || text.length < 2 || /^[0-9\s\-_:/.]+$/.test(text)) {
      return text;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`🌐 Translating via Netlify Function: "${text.substring(0, 50)}..." to ${targetLang}`);
        
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
        
        // Handle successful translation
        if (result.success && result.translatedText) {
          console.log(`🌐 Translation successful: "${result.translatedText.substring(0, 50)}..."`);
          return result.translatedText;
        }
        
        // Handle API key not configured or other errors
        if (!result.success) {
          console.warn(`🌐 Translation failed: ${result.error || 'Unknown error'}`);
          return text; // Return original text
        }

        return text; // Fallback to original text

      } catch (error) {
        console.error(`🌐 Translation attempt ${attempt + 1} failed:`, error);

        if (attempt === retries) {
          console.warn(`🌐 All translation attempts failed, returning original text`);
          return text; // Return original text after all retries failed
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    return text;
  },

  // Enhanced UI translation application with smooth transitions
  applyTranslations(translations) {
    // Update tooltip texts
    document.querySelectorAll("[data-tooltip-key]").forEach((element) => {
      const key = element.getAttribute("data-tooltip-key");
      if (translations.tooltips[key]) {
        const tooltip = element.querySelector(".tooltip-text");
        if (tooltip) {
          // Smooth transition for tooltip updates
          tooltip.style.opacity = "0";
          setTimeout(() => {
            tooltip.textContent = translations.tooltips[key];
            tooltip.style.opacity = "1";
          }, 150);
        }
      }
    });

    // Update UI strings with smooth transitions
    document.querySelectorAll("[data-ui-key]").forEach((element) => {
      const key = element.getAttribute("data-ui-key");
      if (translations.ui[key]) {
        const originalTransition = element.style.transition;
        element.style.transition = "opacity 0.2s ease";
        element.style.opacity = "0.7";

        setTimeout(() => {
          if (element.tagName === "INPUT") {
            if (element.type === "submit" || element.type === "button") {
              element.value = translations.ui[key];
            } else if (element.placeholder) {
              element.placeholder = translations.ui[key];
            }
          } else if (element.tagName === "OPTION") {
            element.textContent = translations.ui[key];
          } else {
            element.textContent = translations.ui[key];
          }

          element.style.opacity = "1";
          element.style.transition = originalTransition;
        }, 200);
      }
    });

    // Update dynamic content (like form labels, headings, etc.)
    this.updateDynamicContent(translations);
  },

  // Update content that might not have data attributes
  updateDynamicContent(translations) {
    // Update common headings
    const headings = {
      h2: ["Ideas", "My Submissions", "Submit Ideas", "Settings"],
      h3: ["Share Your Feedback", "AI Feedback", "Idea Details"],
      h4: [
        "Customer Profile",
        "Product Idea",
        "Pain Points",
        "Alternatives",
        "Projects Summary",
        "All Submissions",
      ],
      label: Object.keys(translations.ui).filter(
        (key) =>
          key.includes("Profile") ||
          key.includes("Idea") ||
          key.includes("Points") ||
          key.includes("Alternatives")
      ),
    };

    Object.entries(headings).forEach(([tagName, keys]) => {
      document.querySelectorAll(tagName).forEach((element) => {
        const text = element.textContent.trim();
        keys.forEach((key) => {
          if (text === key && translations.ui[key]) {
            element.textContent = translations.ui[key];
          }
        });
      });
    });
  },

  // Language code to name mapping
  getLanguageName(code) {
    const names = {
      en: "English",
      am: "አማርኛ (Amharic)",
      fr: "Français (French)",
      sw: "Kiswahili (Swahili)",
      ar: "العربية (Arabic)",
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

  // Initialize translations for current language with loading state
  async init() {
    console.log("🌐 Initializing translator...");

    const currentLang = this.getCurrentLanguage();
    console.log(`🌐 Current language: ${currentLang}`);

    if (currentLang === "en") {
      const translations = {
        tooltips: this.defaultTooltips,
        ui: this.uiStrings,
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
      </div>
    `;

    document.body.appendChild(loadingIndicator);

    try {
      const translations = await this.getTranslations(currentLang);
      this.applyTranslations(translations);
      return translations;
    } finally {
      loadingIndicator.remove();
    }
  },

  // Get translation progress for UI feedback
  getTranslationProgress(completed, total) {
    return {
      percentage: Math.round((completed / total) * 100),
      completed,
      total,
      remaining: total - completed,
    };
  },

  // Clear translation cache (for debugging/updates)
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

  // Validate translation quality (basic check)
  validateTranslation(original, translated, targetLang) {
    // Basic validation checks
    const checks = {
      notEmpty: translated && translated.trim().length > 0,
      notSameAsOriginal: translated !== original,
      reasonableLength:
        translated.length >= original.length * 0.5 &&
        translated.length <= original.length * 3,
      hasValidChars: /[\w\s]/.test(translated),
    };

    const passed = Object.values(checks).every((check) => check);

    return {
      valid: passed,
      checks,
      confidence: passed ? 0.8 : 0.3,
    };
  },
};
