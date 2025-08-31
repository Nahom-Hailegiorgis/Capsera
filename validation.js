// validation.js - Enhanced validation with field name-based approach and draft-specific rules
export const validation = {
  // Helper to extract text from submission object
  extractTextFromSubmission(submission) {
    if (typeof submission === "string") {
      return submission;
    }

    const textFields = [
      submission.ideal_customer_profile,
      submission.product_idea,
      submission.pain_points,
      submission.alternatives,
      // Draft 2 fields
      submission.market_validation,
      submission.competitor_research,
      submission.mvp_development,
      // Draft 3 fields
      submission.investor_pitch,
      submission.additional_research,
      Array.isArray(submission.category)
        ? submission.category.join(" ")
        : submission.category,
      submission.heard_about,
    ].filter(Boolean);

    return textFields.join(" ");
  },

  // Enhanced SPAM detection with more comprehensive patterns
  checkSpam(text) {
    console.log("🔧 VALIDATION DEBUG: Starting SPAM check");

    const spamPatterns = [
      // Marketing phrases
      /buy\s+now/gi,
      /discount/gi,
      /limited\s+time/gi,
      /click\s+here/gi,
      /free\s+trial/gi,
      /act\s+now/gi,
      /special\s+offer/gi,
      /make\s+money\s+fast/gi,
      /earn\s+\$\d+/gi,
      /guaranteed\s+results/gi,
      // Link domains (basic)
      /https?:\/\//gi,
      // Repeated punctuation
      /[!]{3,}/g,
      /[?]{3,}/g,
      // Excessive caps
      /[A-Z]{10,}/g,
      // Crypto/investment spam
      /bitcoin|cryptocurrency|forex|trading/gi,
    ];

    const allText = this.extractTextFromSubmission(text);

    // Check spam patterns
    for (const pattern of spamPatterns) {
      if (pattern.test(allText)) {
        console.log("🔧 VALIDATION DEBUG: SPAM detected - pattern match");
        return {
          isSpam: true,
          reason: "Contains promotional/marketing content",
        };
      }
    }

    // Check lexical density (gibberish detection)
    const words = allText
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const uniqueWords = new Set(words);
    const lexicalDensity = uniqueWords.size / words.length;

    if (lexicalDensity < 0.25 && words.length > 20) {
      console.log("🔧 VALIDATION DEBUG: SPAM detected - low lexical density", {
        lexicalDensity,
        wordCount: words.length,
      });
      return { isSpam: true, reason: "Low content quality detected" };
    }

    // Check for excessive repetition
    const wordCounts = {};
    words.forEach((word) => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    const maxRepetition = Math.max(...Object.values(wordCounts));
    if (maxRepetition > words.length * 0.15 && words.length > 30) {
      console.log("🔧 VALIDATION DEBUG: SPAM detected - excessive repetition", {
        maxRepetition,
        wordCount: words.length,
      });
      return { isSpam: true, reason: "Excessive word repetition detected" };
    }

    console.log("🔧 VALIDATION DEBUG: SPAM check passed");
    return { isSpam: false };
  },

  // Enhanced PRIVACY detection (more comprehensive)
  checkPrivacy(text) {
    console.log("🔧 VALIDATION DEBUG: Starting PRIVACY check");

    const privacyPatterns = [
      // Email addresses (clear format with @ and TLD)
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,

      // Phone numbers (10+ digits, flexible separators)
      /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/,

      // SSN exact format ###-##-####
      /\b\d{3}-\d{2}-\d{4}\b/,

      // Credit card patterns (basic)
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,

      // Street addresses with number + street keyword
      /\b\d{2,5}\s+[A-Za-z]+(?:\s[A-Za-z]+)*\s(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|blvd|boulevard)\b/i,

      // Personal identifiers
      /\b(driver['\s]?license|passport|license\s+number|social\s+security)\b/i,
    ];

    const allText = this.extractTextFromSubmission(text);

    for (const pattern of privacyPatterns) {
      if (pattern.test(allText)) {
        console.log("🔧 VALIDATION DEBUG: PRIVACY violation detected");
        return {
          hasPrivateInfo: true,
          reason: "Contains personal information",
        };
      }
    }

    console.log("🔧 VALIDATION DEBUG: PRIVACY check passed");
    return { hasPrivateInfo: false };
  },

  // Enhanced DUPLICATE detection - checks both existing ideas AND local submissions
  async checkDuplicates(submission, existingIdeas) {
    console.log("🔧 VALIDATION DEBUG: Starting DUPLICATE check", {
      existingIdeasCount: existingIdeas?.length || 0,
    });

    if (!existingIdeas || existingIdeas.length === 0) {
      console.log("🔧 VALIDATION DEBUG: No existing ideas to check against");
      return { isDuplicate: false };
    }

    // Normalize text for comparison
    const normalizeText = (text) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const submissionText = normalizeText(
      `${submission.ideal_customer_profile || ""} ${
        submission.product_idea || ""
      } ${submission.pain_points || ""}`
    );

    console.log(
      "🔧 VALIDATION DEBUG: Normalized submission text length:",
      submissionText.length
    );

    for (let i = 0; i < existingIdeas.length; i++) {
      const idea = existingIdeas[i];
      const ideaText = normalizeText(
        `${idea.ideal_customer_profile || ""} ${
          idea.product_idea || idea.preview || ""
        } ${idea.pain_points || ""}`
      );

      // Enhanced similarity check
      const similarity = this.calculateSimilarity(submissionText, ideaText);

      console.log(`🔧 VALIDATION DEBUG: Similarity with idea ${i}:`, {
        similarity: Math.round(similarity * 100) + "%",
        threshold: "70%",
      });

      if (similarity > 0.7) {
        console.log(
          "🔧 VALIDATION DEBUG: DUPLICATE detected - high similarity"
        );
        return {
          isDuplicate: true,
          reason: `Very similar idea already exists (${Math.round(
            similarity * 100
          )}% similarity)`,
          similarity,
        };
      }
    }

    console.log("🔧 VALIDATION DEBUG: DUPLICATE check passed");
    return { isDuplicate: false };
  },

  // Improved similarity calculation using multiple methods
  async calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;

    // Method 1: Jaccard similarity on words (length > 3)
    const words1 = new Set(text1.split(" ").filter((w) => w.length > 3));
    const words2 = new Set(text2.split(" ").filter((w) => w.length > 3));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const jaccardSimilarity =
      union.size > 0 ? intersection.size / union.size : 0;

    // Method 2: N-gram similarity (bigrams)
    const getBigrams = (text) => {
      const bigrams = new Set();
      for (let i = 0; i < text.length - 1; i++) {
        bigrams.add(text.substring(i, i + 2));
      }
      return bigrams;
    };

    const bigrams1 = getBigrams(text1);
    const bigrams2 = getBigrams(text2);
    const bigramIntersection = new Set(
      [...bigrams1].filter((x) => bigrams2.has(x))
    );
    const bigramUnion = new Set([...bigrams1, ...bigrams2]);
    const bigramSimilarity =
      bigramUnion.size > 0 ? bigramIntersection.size / bigramUnion.size : 0;

    // Weighted combination
    return jaccardSimilarity * 0.7 + bigramSimilarity * 0.3;
  },

  // Enhanced QUALITY scoring with stricter, more detailed criteria
  calculateQualityScore(submission) {
    console.log("🔧 VALIDATION DEBUG: Starting QUALITY scoring");

    let score = 0;
    const scoreBreakdown = {};

    // Problem statement clarity (0-25 points) - Stricter
    if (submission.pain_points && submission.pain_points.length > 30) {
      let problemScore = 8; // Base points reduced

      // Check for specific problem indicators
      const problemKeywords = [
        "problem",
        "issue",
        "challenge",
        "difficulty",
        "struggle",
        "frustration",
        "pain",
        "bottleneck",
        "obstacle",
        "barrier",
      ];
      const problemMatches = problemKeywords.filter((keyword) =>
        submission.pain_points.toLowerCase().includes(keyword)
      ).length;
      problemScore += Math.min(problemMatches * 2, 8);

      // Length bonus (but stricter thresholds)
      if (submission.pain_points.length > 100) problemScore += 4;
      if (submission.pain_points.length > 180) problemScore += 5;

      score += problemScore;
      scoreBreakdown.problemStatement = problemScore;
    } else {
      scoreBreakdown.problemStatement = 0;
    }

    // Target audience definition (0-20 points) - Stricter
    if (
      submission.ideal_customer_profile &&
      submission.ideal_customer_profile.length > 25
    ) {
      let audienceScore = 6; // Base points reduced

      // Check for demographic specificity
      const audienceKeywords = [
        "age",
        "years old",
        "professional",
        "student",
        "business",
        "company",
        "industry",
        "income",
        "location",
        "demographic",
      ];
      const audienceMatches = audienceKeywords.filter((keyword) =>
        submission.ideal_customer_profile.toLowerCase().includes(keyword)
      ).length;
      audienceScore += Math.min(audienceMatches * 2, 8);

      // Length bonus
      if (submission.ideal_customer_profile.length > 80) audienceScore += 3;
      if (submission.ideal_customer_profile.length > 150) audienceScore += 3;

      score += audienceScore;
      scoreBreakdown.targetAudience = audienceScore;
    } else {
      scoreBreakdown.targetAudience = 0;
    }

    // Solution description (0-25 points) - Stricter
    if (submission.product_idea && submission.product_idea.length > 30) {
      let solutionScore = 8; // Base points reduced

      // Check for solution indicators
      const solutionKeywords = [
        "solution",
        "solve",
        "help",
        "enable",
        "provide",
        "platform",
        "app",
        "system",
        "service",
        "tool",
      ];
      const solutionMatches = solutionKeywords.filter((keyword) =>
        submission.product_idea.toLowerCase().includes(keyword)
      ).length;
      solutionScore += Math.min(solutionMatches * 2, 8);

      // Length bonus
      if (submission.product_idea.length > 120) solutionScore += 4;
      if (submission.product_idea.length > 200) solutionScore += 5;

      score += solutionScore;
      scoreBreakdown.solutionDescription = solutionScore;
    } else {
      scoreBreakdown.solutionDescription = 0;
    }

    // Differentiation awareness (0-15 points) - Stricter
    if (submission.alternatives && submission.alternatives.length > 15) {
      let diffScore = 5; // Base points reduced

      // Check for competitive awareness
      const compKeywords = [
        "different",
        "better",
        "unique",
        "unlike",
        "compared to",
        "competitor",
        "alternative",
        "existing",
        "current",
        "market",
      ];
      const compMatches = compKeywords.filter((keyword) =>
        submission.alternatives.toLowerCase().includes(keyword)
      ).length;
      diffScore += Math.min(compMatches * 2, 7);

      // Length bonus
      if (submission.alternatives.length > 60) diffScore += 3;

      score += diffScore;
      scoreBreakdown.differentiation = diffScore;
    } else {
      scoreBreakdown.differentiation = 0;
    }

    // Category selection (0-10 points) - Stricter, ensure array handling
    const categories = Array.isArray(submission.category)
      ? submission.category
      : submission.category
      ? [submission.category]
      : [];

    if (categories.length > 0) {
      let catScore = Math.min(categories.length * 2, 8);
      // Penalty for too many categories (shows lack of focus)
      if (categories.length > 3) catScore -= 2;
      score += catScore;
      scoreBreakdown.categories = catScore;
    } else {
      scoreBreakdown.categories = 0;
    }

    // Quality indicators (0-5 points) - New section
    const allText = this.extractTextFromSubmission(submission).toLowerCase();

    // Positive indicators
    const qualityKeywords = [
      "research",
      "data",
      "evidence",
      "study",
      "analysis",
      "validate",
      "test",
      "prototype",
      "feedback",
      "iterate",
    ];
    const qualityMatches = qualityKeywords.filter((keyword) =>
      allText.includes(keyword)
    ).length;
    let qualityBonus = Math.min(qualityMatches * 1, 5);

    // Penalty for vague language
    const vagueKeywords = [
      "maybe",
      "might",
      "could be",
      "sort of",
      "kind of",
      "probably",
      "possibly",
      "perhaps",
      "i think",
    ];
    const vagueMatches = vagueKeywords.filter((keyword) =>
      allText.includes(keyword)
    ).length;
    const vaguePenalty = Math.min(vagueMatches * 2, 10);

    qualityBonus -= vaguePenalty;
    score += qualityBonus;
    scoreBreakdown.qualityIndicators = qualityBonus;

    const finalScore = Math.max(0, Math.min(score, 100));

    console.log("🔧 VALIDATION DEBUG: QUALITY scoring complete", {
      finalScore,
      breakdown: scoreBreakdown,
    });

    return finalScore;
  },

  // Word count validation with detailed feedback
  validateWordCount(text, min, max) {
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    const count = words.length;

    return {
      count,
      valid: count >= min && count <= max,
      min,
      max,
    };
  },

  // Field name-based validation for different draft stages
  validateRequiredFields(submission, draftNumber = 1) {
    console.log("🔧 VALIDATION DEBUG: Checking required fields for draft", draftNumber);

    const errors = [];
    
    // Draft 1 required fields
    const draft1Fields = {
      ideal_customer_profile: "Who would love this?",
      product_idea: "What's your solution?",
      pain_points: "What problems does this solve?",
      alternatives: "What alternatives exist?"
    };

    // Draft 2 required fields (in addition to draft 1)
    const draft2Fields = {
      market_validation: "Did you talk to potential customers?",
      competitor_research: "How deep did you research competitors?"
    };

    // Draft 3 required fields (in addition to previous)
    const draft3Fields = {
      investor_pitch: "Your investor pitch"
    };

    // Check required fields based on draft number
    let requiredFields = { ...draft1Fields };
    if (draftNumber >= 2) {
      requiredFields = { ...requiredFields, ...draft2Fields };
    }
    if (draftNumber >= 3) {
      requiredFields = { ...requiredFields, ...draft3Fields };
    }

    // Validate each required field
    Object.entries(requiredFields).forEach(([fieldName, displayName]) => {
      const value = submission[fieldName];
      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        errors.push(`${displayName} is required`);
        console.log(`🔧 VALIDATION DEBUG: Missing required field: ${fieldName}`);
      }
    });

    return {
      passed: errors.length === 0,
      errors,
      requiredFieldsCount: Object.keys(requiredFields).length
    };
  },

  // Validate submission completeness with draft-specific requirements
  validateCompleteness(submission, draftNumber = 1) {
    console.log("🔧 VALIDATION DEBUG: Checking completeness for draft", draftNumber);

    const fieldValidation = this.validateRequiredFields(submission, draftNumber);
    
    if (!fieldValidation.passed) {
      return {
        complete: false,
        missingRequired: fieldValidation.errors,
        missingOptional: [],
        completionScore: Math.max(0, 100 - (fieldValidation.errors.length / fieldValidation.requiredFieldsCount) * 100)
      };
    }

    // Check optional fields
    const optionalFields = ["category", "heard_about"];
    if (draftNumber >= 2) {
      optionalFields.push("mvp_development", "product_photo");
    }
    if (draftNumber >= 3) {
      optionalFields.push("additional_research", "mvp_link");
    }

    const missingOptional = optionalFields.filter(
      (field) => {
        const value = submission[field];
        return !value || 
               (Array.isArray(value) && value.length === 0) ||
               (typeof value === 'string' && value.trim().length === 0);
      }
    );

    console.log("🔧 VALIDATION DEBUG: Completeness check", {
      missingRequired: [],
      missingOptional: missingOptional,
    });

    return {
      complete: true,
      missingRequired: [],
      missingOptional: missingOptional,
      completionScore: Math.max(0, 100 - missingOptional.length * 5),
    };
  },

  // Enhanced validation function with draft-specific logic
  async validateSubmission(submission, existingIdeas = [], draftNumber = 1) {
    console.log(
      "🔧 VALIDATION DEBUG: ========== STARTING VALIDATION =========="
    );
    console.log("🔧 VALIDATION DEBUG: Submission data:", {
      draftNumber,
      hasCustomerProfile: !!submission.ideal_customer_profile,
      hasProductIdea: !!submission.product_idea,
      hasPainPoints: !!submission.pain_points,
      hasAlternatives: !!submission.alternatives,
      // Draft 2 fields
      hasMarketValidation: !!submission.market_validation,
      hasCompetitorResearch: !!submission.competitor_research,
      hasMvpDevelopment: !!submission.mvp_development,
      // Draft 3 fields
      hasInvestorPitch: !!submission.investor_pitch,
      hasAdditionalResearch: !!submission.additional_research,
      hasMvpLink: !!submission.mvp_link,
      categories: submission.category,
      existingIdeasCount: existingIdeas?.length || 0,
    });

    const results = {
      passed: true,
      errors: [],
      warnings: [],
      qualityScore: 0,
      draftNumber,
    };

    // Ensure category is always an array for consistency
    if (!Array.isArray(submission.category)) {
      if (submission.category) {
        submission.category = [submission.category];
      } else {
        submission.category = [];
      }
    }

    console.log(
      "🔧 VALIDATION DEBUG: Categories normalized to array:",
      submission.category
    );

    // Check completeness based on draft number
    const completeness = this.validateCompleteness(submission, draftNumber);
    if (!completeness.complete) {
      results.passed = false;
      completeness.missingRequired.forEach((error) => {
        results.errors.push(`REQUIRED_FIELD_MISSING: ${error}`);
      });
    }

    // Check SPAM
    const spamCheck = this.checkSpam(submission);
    if (spamCheck.isSpam) {
      results.passed = false;
      results.errors.push(`SPAM: ${spamCheck.reason}`);
    }

    // Check PRIVACY
    const privacyCheck = this.checkPrivacy(submission);
    if (privacyCheck.hasPrivateInfo) {
      results.passed = false;
      results.errors.push(`PRIVACY: ${privacyCheck.reason}`);
    }

    // Check DUPLICATES (only for final submissions)
    if (draftNumber >= 3) {
      const duplicateCheck = await this.checkDuplicates(
        submission,
        existingIdeas
      );
      if (duplicateCheck.isDuplicate) {
        results.passed = false;
        results.errors.push(`DUPLICATE: ${duplicateCheck.reason}`);
      }
    }

    // Calculate QUALITY score with draft-specific adjustments
    let qualityScore = this.calculateQualityScore(submission);
    
    // Bonus points for draft 2 and 3 completeness
    if (draftNumber >= 2) {
      if (submission.market_validation && submission.market_validation.length > 50) {
        qualityScore += 5;
      }
      if (submission.competitor_research && submission.competitor_research.length > 50) {
        qualityScore += 5;
      }
    }
    
    if (draftNumber >= 3) {
      if (submission.investor_pitch && submission.investor_pitch.length > 30) {
        qualityScore += 10;
      }
      if (submission.mvp_link) {
        qualityScore += 5;
      }
    }

    results.qualityScore = Math.min(qualityScore, 100);

    // Draft-specific quality thresholds
    const minThresholds = { 1: 25, 2: 35, 3: 45 };
    const minThreshold = minThresholds[draftNumber] || 25;

    if (results.qualityScore < minThreshold) {
      results.passed = false;
      results.errors.push(
        `QUALITY_LOW: Quality score ${results.qualityScore}/100 is below minimum threshold (${minThreshold}) for draft ${draftNumber}`
      );
    } else if (results.qualityScore < minThreshold + 15) {
      results.warnings.push(
        `Quality score ${results.qualityScore}/100 could be improved. Consider adding more detail.`
      );
    }

    // Word count validations (draft 1 fields always validated)
    const baseValidations = [
      { field: "product_idea", min: 15, max: 300 },
      { field: "ideal_customer_profile", min: 10, max: 200 },
      { field: "pain_points", min: 15, max: 250 },
      { field: "alternatives", min: 5, max: 200 },
    ];

    // Add draft-specific validations
    if (draftNumber >= 2) {
      baseValidations.push(
        { field: "market_validation", min: 20, max: 400 },
        { field: "competitor_research", min: 15, max: 350 }
      );
    }

    if (draftNumber >= 3) {
      baseValidations.push(
        { field: "investor_pitch", min: 20, max: 150 }
      );
    }

    baseValidations.forEach(({ field, min, max }) => {
      if (submission[field]) {
        const wordCheck = this.validateWordCount(submission[field], min, max);
        if (!wordCheck.valid) {
          if (wordCheck.count < min) {
            results.passed = false;
            results.errors.push(
              `WORD_COUNT_LOW: ${field.replace('_', ' ')} too short (${wordCheck.count} words, minimum ${min})`
            );
          } else if (wordCheck.count > max) {
            results.warnings.push(
              `WORD_COUNT_HIGH: ${field.replace('_', ' ')} very long (${wordCheck.count} words, maximum ${max})`
            );
          }
        }
      }
    });

    // Enhanced category validation
    if (submission.category.length === 0) {
      results.warnings.push(
        "No categories selected - this helps with organization"
      );
    } else if (submission.category.length > 5) {
      results.warnings.push(
        "Too many categories selected (max 5) - focus on the most relevant"
      );
    }

    console.log(
      "🔧 VALIDATION DEBUG: ========== VALIDATION COMPLETE =========="
    );
    console.log("🔧 VALIDATION DEBUG: Final results:", {
      passed: results.passed,
      errorsCount: results.errors.length,
      warningsCount: results.warnings.length,
      qualityScore: results.qualityScore,
      draftNumber: results.draftNumber,
      errors: results.errors,
      warnings: results.warnings.slice(0, 3), // Show first 3 warnings
    });

    return results;
  },
};
