const GOOGLE_TRANSLATE_API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY;

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "sw", name: "Swahili" },
  { code: "ar", name: "Arabic" },
  { code: "es", name: "Spanish" },
  { code: "pt", name: "Portuguese" },
  { code: "ha", name: "Hausa" },
  { code: "ur", name: "Urdu" },
  { code: "th", name: "Thai" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese (Simplified)" },
];

export const DEFAULT_LANGUAGE = "en";

// UI Text translations
export const UI_TEXTS = {
  en: {
    appTitle: "Capsera",
    allIdeas: "All Ideas",
    mySubmissions: "My Submissions",
    submitIdea: "Submit Your Product Idea",
    fullName: "Full Name",
    whoYouServe: "Who You Serve",
    productIdea: "Product Idea",
    categories: "Categories",
    howYouHeard: "How You Heard of Capsera",
    userPainPoints: "User Pain Points",
    existingAlternatives: "Existing Alternatives / Workarounds",
    userCapabilities: "User Capabilities / Access",
    submitButton: "Submit Idea",
    processFlow: "How Ideas Are Evaluated",
    aiEvaluation: "AI evaluates for spam, duplicates, and privacy violations",
    scoring: "Valid ideas receive a score (0-100)",
    humanReview: "Human judges evaluate top ideas",
    mentoring: "At least 10% progress to mentoring/funding",
    feedback: "Feedback",
    feedbackPlaceholder: "Share your thoughts about Capsera (optional)",
    contactInfo: "Contact Info (optional)",
    submitFeedback: "Submit Feedback",
    refreshing: "Refreshing...",
    seconds: "s",
    rateLimitMessage: "Please wait {time} more seconds before submitting again",
    wordLimit: "words",
    maxWords: "max {limit} words",
    categories: {
      technology: "Technology",
      healthcare: "Healthcare",
      education: "Education",
      finance: "Finance",
      environment: "Environment",
      social: "Social Impact",
      entertainment: "Entertainment",
      transportation: "Transportation",
      food: "Food & Agriculture",
      other: "Other",
    },
    sources: {
      social_media: "Social Media",
      search_engine: "Search Engine",
      friend_referral: "Friend Referral",
      advertisement: "Advertisement",
      other: "Other",
    },
    tooltips: {
      whoYouServe:
        "Describe your target users or customers. Who would benefit from your product idea?",
      productIdea:
        "Describe your product or service idea. What problem does it solve? How does it work?",
      userPainPoints:
        "What specific problems or frustrations do your target users currently face?",
      existingAlternatives:
        "What solutions currently exist? How do people solve this problem today?",
      userCapabilities:
        "What resources, skills, or access do your target users have? What are their limitations?",
    },
  },
  // Other languages would be dynamically translated via Google Translate API
};

let currentLanguage = DEFAULT_LANGUAGE;
let translationCache = new Map();

export const getCurrentLanguage = () => currentLanguage;

export const setCurrentLanguage = (language) => {
  currentLanguage = language;
};

export const translateText = async (text, targetLanguage = currentLanguage) => {
  if (targetLanguage === "en" || !text) return text;

  const cacheKey = `${text}_${targetLanguage}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: text,
          target: targetLanguage,
          source: "en",
          format: "text",
        }),
      }
    );

    if (!response.ok) {
      console.warn("Translation failed, using original text");
      return text;
    }

    const data = await response.json();
    const translatedText = data.data.translations[0].translatedText;

    translationCache.set(cacheKey, translatedText);
    return translatedText;
  } catch (error) {
    console.warn("Translation error:", error);
    return text;
  }
};

export const getUIText = (key, replacements = {}) => {
  let text = UI_TEXTS.en[key] || key;

  // Handle nested keys like 'categories.technology'
  const keys = key.split(".");
  let current = UI_TEXTS.en;

  for (const k of keys) {
    if (current && current[k]) {
      current = current[k];
    } else {
      current = key;
      break;
    }
  }

  text = typeof current === "string" ? current : key;

  // Replace placeholders like {time} with actual values
  Object.keys(replacements).forEach((placeholder) => {
    text = text.replace(`{${placeholder}}`, replacements[placeholder]);
  });

  return text;
};
