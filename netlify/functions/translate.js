// netlify/functions/translate.js
// Enhanced serverless function to handle Google Translate API calls securely
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const GOOGLE_TRANSLATE_KEY = process.env.GOOGLE_TRANSLATE_KEY;
    
    if (!GOOGLE_TRANSLATE_KEY) {
      console.warn('Google Translate API key not configured');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false,
          error: 'API key not configured - translations disabled',
          translatedText: null // Client will use original text as fallback
        })
      };
    }

    const { text, targetLang, sourceLang = 'en' } = JSON.parse(event.body);
    
    if (!text || !targetLang) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false,
          error: 'Missing required fields: text and targetLang' 
        })
      };
    }

    // Validate target language (support Indian languages)
    const supportedLangs = ['hi', 'bn', 'te', 'mr', 'ta', 'gu', 'ur', 'ml', 'en'];
    if (!supportedLangs.includes(targetLang)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false,
          error: `Unsupported target language: ${targetLang}. Supported: ${supportedLangs.join(', ')}` 
        })
      };
    }

    // Skip translation for very short or non-translatable content
    if (text.length < 2 || /^[0-9\s\-_:/.]+$/.test(text)) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: true,
          translatedText: text, // Return original for non-translatable content
          skipped: true,
          reason: 'Non-translatable content'
        })
      };
    }

    // Return original text if source and target are the same
    if (sourceLang === targetLang) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: true,
          translatedText: text,
          skipped: true,
          reason: 'Same source and target language'
        })
      };
    }

    console.log(`Translating "${text.substring(0, 50)}..." from ${sourceLang} to ${targetLang}`);

    const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        source: sourceLang,
        format: 'text'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Translate API error: ${response.status} - ${errorText}`);
      
      throw new Error(`Translation API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data || !data.data.translations || !data.data.translations[0]) {
      throw new Error('Invalid response format from Google Translate API');
    }

    const translatedText = data.data.translations[0].translatedText;
    
    // Decode HTML entities that Google Translate might return
    const decodedText = translatedText
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&nbsp;/g, ' ');

    // Basic validation of translation quality
    const isValidTranslation = decodedText.trim().length > 0 && 
                              decodedText !== text &&
                              !/^[\s\-_:/.]*$/.test(decodedText);

    if (!isValidTranslation) {
      console.warn(`Poor translation quality for "${text}" -> "${decodedText}"`);
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          translatedText: text, // Fallback to original
          warning: 'Translation quality was poor, returned original text'
        })
      };
    }

    console.log(`Translation successful: "${text.substring(0, 30)}..." -> "${decodedText.substring(0, 30)}..."`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        translatedText: decodedText,
        originalText: text,
        detectedSourceLanguage: data.data.translations[0].detectedSourceLanguage || sourceLang
      })
    };

  } catch (error) {
    console.error('Translation function error:', error);
    
    // Return graceful fallback instead of hard error
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        translatedText: null, // Client will use original text as fallback
        fallbackReason: 'Translation service temporarily unavailable'
      })
    };
  }
};
