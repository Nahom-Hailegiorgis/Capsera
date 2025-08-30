// netlify/functions/openai-feedback.js
// Serverless function to handle OpenAI API calls securely

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
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'API key not configured',
          mock: true,
          data: getMockAIFeedback()
        })
      };
    }

    const submission = JSON.parse(event.body);
    
    if (!submission || !submission.ideal_customer_profile || !submission.product_idea) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Invalid submission data' })
      };
    }

    const categoriesText = Array.isArray(submission.category)
      ? submission.category.join(', ')
      : submission.category || 'None';

    // Prepare enhanced prompt with draft tracking and cooldown logic
    const draftNumber = submission.draft_number || 1;
    const previousScore = submission.previous_score || null;
    const isFirstDraft = draftNumber === 1;
    const cooldownDays = process.env.FEEDBACK_COOLDOWN_DAYS || '7';

    // Enhanced system prompt with new grading behavior
    const systemPrompt = `You are an expert business analyst providing structured feedback on startup ideas. Your role is to be encouraging yet constructive, helping entrepreneurs improve their ideas through actionable insights.

CRITICAL GRADING RULES:
1. MINIMUM SCORE FLOOR: Unless the idea is truly irredeemable (plagiarized, illegal, or completely nonsensical), DO NOT score below 70/100 on any evaluation
2. PROS/CONS FORMAT: Replace detailed critique with bullet points labeled "Pros:" and "Cons:" - do not separate into categories
3. SCORING PSYCHOLOGY: Be generous but honest - focus on potential and improvement rather than harsh criticism
4. AI DETECTION: If the idea appears to be AI-generated (generic language, buzzwords, lack of specifics), add warning about considering environmental context

DRAFT TRACKING RULES:
- This is draft #${draftNumber}
- Previous score: ${previousScore || 'N/A (first submission)'}
- If draft ≥2 AND current score ≥ 80 AND score improved from previous: Add "Great iteration — please enter your email to connect with a mentor soon."
- If this is the first draft, add: "After submitting your first draft, conduct customer interviews before resubmitting. There is a ${cooldownDays}-day waiting period for additional submissions."

FEEDBACK LENGTH RULES:
- Score < 75: Provide long, detailed feedback with specific actionable steps
- Score ≥ 85: Keep feedback concise but encouraging
- Score 75-84: Moderate length with key improvements highlighted

Analyze the idea and provide feedback in this EXACT JSON structure:

{
  "critique": {
    "pros": ["specific pro 1", "specific pro 2", "specific pro 3"],
    "cons": ["specific con 1", "specific con 2", "specific con 3"]
  },
  "suggestions": [
    "specific actionable suggestion 1",
    "specific actionable suggestion 2", 
    "specific actionable suggestion 3",
    "specific actionable suggestion 4"
  ],
  "grading": {
    "problem_significance": {
      "score": 7-10,
      "reasoning": "brief explanation for this score"
    },
    "target_audience": {
      "score": 7-10,
      "reasoning": "brief explanation for this score"
    },
    "uniqueness": {
      "score": 6-10,
      "reasoning": "brief explanation for this score"
    },
    "scalability": {
      "score": 7-10,
      "reasoning": "brief explanation for this score"
    },
    "competition": {
      "score": 6-10,
      "reasoning": "brief explanation for this score"
    },
    "business_viability": {
      "score": 7-10,
      "reasoning": "brief explanation for this score"
    },
    "adoption_potential": {
      "score": 7-10,
      "reasoning": "brief explanation for this score"
    },
    "risk_assessment": {
      "score": 6-10,
      "reasoning": "brief explanation (higher score = lower risk)"
    },
    "impact_potential": {
      "score": 7-10,
      "reasoning": "brief explanation for this score"
    }
  },
  "overall_score": 70-100,
  "summary": "2-4 sentences based on score level - long if <75, concise if ≥85",
  "special_notes": "Draft tracking info, mentor connection prompts, cooldown notices, AI detection warnings"
}

Remember: Focus on encouragement and growth potential while providing honest, actionable feedback.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Please analyze this startup idea:

DRAFT NUMBER: ${draftNumber}
PREVIOUS SCORE: ${previousScore || 'First submission'}

TARGET CUSTOMER: ${submission.ideal_customer_profile}

PRODUCT IDEA: ${submission.product_idea}

PAIN POINTS ADDRESSED: ${submission.pain_points}

EXISTING ALTERNATIVES: ${submission.alternatives}

CATEGORIES: ${categoriesText}

Provide structured critique with pros/cons bullets, suggestions, detailed grading, and appropriate feedback length based on scoring rules.`
          }
        ],
        max_tokens: 3500 // Increased for potentially longer feedback
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Parse JSON response
    const feedback = JSON.parse(content);

    // Validate structure and apply minimum score enforcement
    if (!feedback.critique || !feedback.suggestions || !feedback.grading || typeof feedback.overall_score !== 'number') {
      throw new Error('Invalid AI response format');
    }

    // Enforce minimum score floor (70/100) unless truly irredeemable
    if (feedback.overall_score < 70) {
      console.log(`Enforcing minimum score floor: ${feedback.overall_score} -> 70`);
      feedback.overall_score = 70;
      feedback.special_notes = (feedback.special_notes || '') + ' Note: Minimum scoring floor applied to encourage development.';
    }

    // Add draft tracking and mentor connection logic
    let specialNotes = feedback.special_notes || '';
    
    // Check for mentor connection trigger
    if (draftNumber >= 2 && feedback.overall_score >= 80 && previousScore && feedback.overall_score > previousScore) {
      specialNotes += ' Great iteration — please enter your email to connect with a mentor soon.';
    }
    
    // Add cooldown notice for first drafts
    if (isFirstDraft) {
      specialNotes += ` After submitting your first draft, conduct customer interviews before resubmitting. There is a ${cooldownDays}-day waiting period for additional submissions.`;
    }

    // Add AI detection warning if score suggests it
    // TODO: Implement AI detection logic based on content analysis
    
    feedback.special_notes = specialNotes.trim();

    // Calculate and validate overall score
    const scores = Object.values(feedback.grading).map(item => item.score);
    const calculatedScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10);

    // Allow some flexibility but enforce minimum
    if (feedback.overall_score < 70) {
      feedback.overall_score = Math.max(70, calculatedScore);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(feedback)
    };

  } catch (error) {
    console.error('OpenAI function error:', error);
    
    return {
      statusCode: 200, // Return 200 with mock data for graceful fallback
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mock: true,
        data: getEnhancedMockAIFeedback()
      })
    };
  }
};

// Enhanced mock AI feedback fallback with new format
function getEnhancedMockAIFeedback() {
  const scores = {
    problem_significance: Math.floor(Math.random() * 3) + 7, // 7-9
    target_audience: Math.floor(Math.random() * 3) + 7, // 7-9
    uniqueness: Math.floor(Math.random() * 4) + 6, // 6-9
    scalability: Math.floor(Math.random() * 3) + 7, // 7-9
    competition: Math.floor(Math.random() * 4) + 6, // 6-9
    business_viability: Math.floor(Math.random() * 3) + 7, // 7-9
    adoption_potential: Math.floor(Math.random() * 3) + 7, // 7-9
    risk_assessment: Math.floor(Math.random() * 4) + 6, // 6-9
    impact_potential: Math.floor(Math.random() * 3) + 7 // 7-9
  };

  const overall_score = Math.max(70, Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / 9) * 10));
  const cooldownDays = process.env.FEEDBACK_COOLDOWN_DAYS || '7';

  return {
    critique: {
      pros: [
        "Addresses a clear and identifiable problem that resonates with target users",
        "Shows good understanding of customer pain points and market needs", 
        "Demonstrates potential for meaningful differentiation in the market"
      ],
      cons: [
        "Market validation could be strengthened with more customer research",
        "Revenue model and financial projections need more detailed development",
        "Competitive analysis requires deeper investigation of indirect competitors"
      ]
    },
    suggestions: [
      "Conduct 10-15 customer interviews to validate problem significance and solution fit",
      "Create a detailed competitive analysis including both direct and indirect competitors", 
      "Develop a minimum viable product (MVP) to test core value propositions",
      "Build financial models with realistic customer acquisition costs and lifetime value"
    ],
    grading: {
      problem_significance: {
        score: scores.problem_significance,
        reasoning: "Strong problem identification with clear market relevance"
      },
      target_audience: {
        score: scores.target_audience,
        reasoning: "Well-defined audience with room for further segmentation"
      },
      uniqueness: {
        score: scores.uniqueness,
        reasoning: "Good differentiation potential with unique value proposition"
      },
      scalability: {
        score: scores.scalability,
        reasoning: "Business model shows strong potential for sustainable growth"
      },
      competition: {
        score: scores.competition,
        reasoning: "Competitive awareness present with opportunity for deeper analysis"
      },
      business_viability: {
        score: scores.business_viability,
        reasoning: "Sound business fundamentals with clear path to profitability"
      },
      adoption_potential: {
        score: scores.adoption_potential,
        reasoning: "Strong value proposition should drive user adoption"
      },
      risk_assessment: {
        score: scores.risk_assessment,
        reasoning: "Manageable risks with proper planning and execution"
      },
      impact_potential: {
        score: scores.impact_potential,
        reasoning: "Significant potential to create meaningful value for users"
      }
    },
    overall_score: overall_score,
    summary: overall_score >= 85 
      ? "Strong idea with clear market opportunity and solid execution potential. Focus on validation and MVP development." 
      : overall_score >= 75
      ? "Promising concept with good foundation. Key areas for improvement include market validation, competitive analysis, and financial planning. The idea shows real potential with proper development."
      : "Good starting point with several areas for development. Focus on conducting thorough customer interviews to validate assumptions, research competitors extensively, and develop detailed financial projections. Consider pivoting aspects that don't resonate with target users.",
    special_notes: `After submitting your first draft, conduct customer interviews before resubmitting. There is a ${cooldownDays}-day waiting period for additional submissions.`
  };
}

// Legacy mock function for backwards compatibility  
function getMockAIFeedback() {
  return getEnhancedMockAIFeedback();
}
