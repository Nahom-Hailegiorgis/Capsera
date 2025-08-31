// validation.js - Enhanced Criteria A validation with proper 3-draft system and strict AI grading
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
  calculateSimilarity(text1, text2) {
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

  // Check for technical feasibility indicators
  checkTechnicalFeasibility(submission) {
    const allText = this.extractTextFromSubmission(submission).toLowerCase();

    const complexityIndicators = [
      "ai",
      "machine learning",
      "blockchain",
      "quantum",
      "neural network",
      "cryptocurrency",
      "autonomous",
    ];

    const simplicityIndicators = [
      "simple",
      "basic",
      "straightforward",
      "easy to build",
      "minimal viable product",
      "mvp",
    ];

    const complexityScore = complexityIndicators.filter((indicator) =>
      allText.includes(indicator)
    ).length;

    const simplicityScore = simplicityIndicators.filter((indicator) =>
      allText.includes(indicator)
    ).length;

    return {
      complexity: complexityScore,
      simplicity: simplicityScore,
      feasibilityScore: Math.max(0, 10 - complexityScore + simplicityScore),
    };
  },

  // Check for market understanding
  checkMarketUnderstanding(submission) {
    const allText = this.extractTextFromSubmission(submission).toLowerCase();

    const marketKeywords = [
      "target market",
      "market research",
      "competitive analysis",
      "user research",
      "customer interviews",
      "market size",
      "addressable market",
      "market opportunity",
    ];

    const marketScore = marketKeywords.filter((keyword) =>
      allText.includes(keyword)
    ).length;

    return {
      marketAwareness: marketScore > 0,
      marketScore: Math.min(marketScore * 2, 10),
    };
  },

  // Validate submission completeness
  validateCompleteness(submission) {
    console.log("🔧 VALIDATION DEBUG: Checking completeness");

    const requiredFields = [
      "ideal_customer_profile",
      "product_idea",
      "pain_points",
      "alternatives",
    ];

    const missingFields = requiredFields.filter(
      (field) => !submission[field] || submission[field].trim().length === 0
    );

    const optionalFields = ["category", "heard_about"];
    const missingOptional = optionalFields.filter(
      (field) =>
        !submission[field] ||
        (Array.isArray(submission[field]) && submission[field].length === 0)
    );

    console.log("🔧 VALIDATION DEBUG: Completeness check", {
      missingRequired: missingFields,
      missingOptional: missingOptional,
    });

    return {
      complete: missingFields.length === 0,
      missingRequired: missingFields,
      missingOptional: missingOptional,
      completionScore: Math.max(
        0,
        100 - missingFields.length * 25 - missingOptional.length * 5
      ),
    };
  },

  // Main validation function - Enhanced Criteria A with comprehensive debugging
  async validateSubmission(submission, existingIdeas = []) {
    console.log(
      "🔧 VALIDATION DEBUG: ========== STARTING VALIDATION =========="
    );
    console.log("🔧 VALIDATION DEBUG: Submission data:", {
      hasCustomerProfile: !!submission.ideal_customer_profile,
      hasProductIdea: !!submission.product_idea,
      hasPainPoints: !!submission.pain_points,
      hasAlternatives: !!submission.alternatives,
      categories: submission.category,
      existingIdeasCount: existingIdeas?.length || 0,
    });

    const results = {
      passed: true,
      errors: [],
      warnings: [],
      qualityScore: 0,
    };

    // Ensure category is always an array for consistency with Supabase text[] type
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

    // Check completeness first
    const completeness = this.validateCompleteness(submission);
    if (!completeness.complete) {
      results.passed = false;
      completeness.missingRequired.forEach((field) => {
        results.errors.push(`REQUIRED_FIELD_MISSING: ${field} is required`);
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

    // Check DUPLICATES
    const duplicateCheck = await this.checkDuplicates(
      submission,
      existingIdeas
    );
    if (duplicateCheck.isDuplicate) {
      results.passed = false;
      results.errors.push(`DUPLICATE: ${duplicateCheck.reason}`);
    }

    // Calculate QUALITY score (stricter thresholds)
    const qualityScore = this.calculateQualityScore(submission);
    results.qualityScore = qualityScore;

    // Stricter quality thresholds
    if (qualityScore < 30) {
      results.passed = false;
      results.errors.push(
        `QUALITY_LOW: Quality score ${qualityScore}/100 is below minimum threshold (30)`
      );
    } else if (qualityScore < 50) {
      results.warnings.push(
        `Quality score ${qualityScore}/100 is relatively low. Consider adding more detail.`
      );
    }

    // Stricter word count validations
    const validations = [
      { field: "product_idea", min: 15, max: 300 },
      { field: "ideal_customer_profile", min: 10, max: 200 },
      { field: "pain_points", min: 15, max: 250 },
      { field: "alternatives", min: 5, max: 200 },
    ];

    validations.forEach(({ field, min, max }) => {
      if (submission[field]) {
        const wordCheck = this.validateWordCount(submission[field], min, max);
        if (!wordCheck.valid) {
          if (wordCheck.count < min) {
            results.passed = false;
            results.errors.push(
              `WORD_COUNT_LOW: ${field} too short (${wordCheck.count} words, minimum ${min})`
            );
          } else if (wordCheck.count > max) {
            results.warnings.push(
              `WORD_COUNT_HIGH: ${field} very long (${wordCheck.count} words, maximum ${max})`
            );
          }
        }
      }
    });

    // Enhanced category validation
    if (submission.category.length === 0) {
      results.warnings.push(
        "No categories selected - this helps with categorization"
      );
    } else if (submission.category.length > 5) {
      results.warnings.push(
        "Too many categories selected (max 5) - focus on the most relevant"
      );
    }

    // Content quality checks
    const allText = this.extractTextFromSubmission(submission).toLowerCase();

    // Check for minimal effort indicators
    const minimalEffortPhrases = [
      "i need help",
      "please help",
      "any ideas",
      "what do you think",
      "not sure",
      "dont know",
      "maybe something",
      "just an idea",
    ];

    const minimalEffortFound = minimalEffortPhrases.some((phrase) =>
      allText.includes(phrase)
    );

    if (minimalEffortFound) {
      results.warnings.push(
        "Consider providing more specific details and concrete plans"
      );
    }

    // Check for business viability indicators
    const businessKeywords = [
      "revenue",
      "profit",
      "business model",
      "monetize",
      "pricing",
      "market size",
      "customers",
      "demand",
      "value proposition",
    ];

    const businessMatches = businessKeywords.filter((keyword) =>
      allText.includes(keyword)
    ).length;

    if (businessMatches === 0) {
      results.warnings.push(
        "Consider addressing business model and monetization strategy"
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
      errors: results.errors,
      warnings: results.warnings.slice(0, 3), // Show first 3 warnings
    });

    return results;
  },
};
