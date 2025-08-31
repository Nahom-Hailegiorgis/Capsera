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
            content: `You are an expert business analyst providing structured feedback on startup ideas. 

Analyze the idea thoroughly and provide feedback in this EXACT JSON structure:

{
  "critique": {
    "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
    "weaknesses": ["specific weakness 1", "specific weakness 2", "specific weakness 3"]
  },
  "suggestions": [
    "specific actionable suggestion 1",
    "specific actionable suggestion 2", 
    "specific actionable suggestion 3",
    "specific actionable suggestion 4"
  ],
  "grading": {
    "problem_significance": {
      "score": 0-10,
      "reasoning": "brief explanation for this score"
    },
    "target_audience": {
      "score": 0-10,
      "reasoning": "brief explanation for this score"
    },
    "uniqueness": {
      "score": 0-10,
      "reasoning": "brief explanation for this score"
    },
    "scalability": {
      "score": 0-10,
      "reasoning": "brief explanation for this score"
    },
    "competition": {
      "score": 0-10,
      "reasoning": "brief explanation for this score"
    },
    "business_viability": {
      "score": 0-10,
      "reasoning": "brief explanation for this score"
    },
    "adoption_potential": {
      "score": 0-10,
      "reasoning": "brief explanation for this score"
    },
    "risk_assessment": {
      "score": 0-10,
      "reasoning": "brief explanation for this score (higher score = lower risk)"
    },
    "impact_potential": {
      "score": 0-10,
      "reasoning": "brief explanation for this score"
    }
  },
  "overall_score": 0-100,
  "summary": "2-3 sentence overall assessment"
}

Be honest and constructive. Focus on specific, actionable insights.`
          },
          {
            role: 'user',
            content: `Please analyze this startup idea:

TARGET CUSTOMER: ${submission.ideal_customer_profile}

PRODUCT IDEA: ${submission.product_idea}

PAIN POINTS ADDRESSED: ${submission.pain_points}

EXISTING ALTERNATIVES: ${submission.alternatives}

CATEGORIES: ${categoriesText}

Provide structured critique, suggestions, and detailed grading for each criterion.`
          }
        ],
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Parse JSON response
    const feedback = JSON.parse(content);

    // Validate structure
    if (!feedback.critique || !feedback.suggestions || !feedback.grading || typeof feedback.overall_score !== 'number') {
      throw new Error('Invalid AI response format');
    }

    // Calculate overall score from individual scores if not provided or seems wrong
    const scores = Object.values(feedback.grading).map(item => item.score);
    const calculatedScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10);

    if (Math.abs(feedback.overall_score - calculatedScore) > 15) {
      feedback.overall_score = calculatedScore;
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
        data: getMockAIFeedback()
      })
    };
  }
};

// Mock AI feedback fallback
function getMockAIFeedback() {
  const scores = {
    problem_significance: Math.floor(Math.random() * 4) + 5, // 5-8
    target_audience: Math.floor(Math.random() * 4) + 4, // 4-7
    uniqueness: Math.floor(Math.random() * 5) + 3, // 3-7
    scalability: Math.floor(Math.random() * 4) + 4, // 4-7
    competition: Math.floor(Math.random() * 5) + 3, // 3-7
    business_viability: Math.floor(Math.random() * 4) + 4, // 4-7
    adoption_potential: Math.floor(Math.random() * 5) + 4, // 4-8
    risk_assessment: Math.floor(Math.random() * 3) + 5, // 5-7
    impact_potential: Math.floor(Math.random() * 4) + 4 // 4-7
  };

  const overall_score = Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / 9) * 10);

  return {
    critique: {
      strengths: [
        "Addresses a clear and identifiable problem in the target market",
        "Shows understanding of customer pain points and needs",
        "Has potential for differentiation from existing solutions"
      ],
      weaknesses: [
        "Market size and validation needs more research and data",
        "Revenue model and unit economics require detailed analysis",
        "Competitive positioning could be stronger and more specific"
      ]
    },
    suggestions: [
      "Conduct customer interviews to validate problem significance and willingness to pay",
      "Research and analyze both direct and indirect competitors more thoroughly",
      "Develop a minimum viable product (MVP) to test core assumptions",
      "Create detailed financial projections including customer acquisition costs"
    ],
    grading: {
      problem_significance: {
        score: scores.problem_significance,
        reasoning: "Problem is relevant but needs stronger evidence of market demand"
      },
      target_audience: {
        score: scores.target_audience,
        reasoning: "Target audience is identifiable but could be more specific and segmented"
      },
      uniqueness: {
        score: scores.uniqueness,
        reasoning: "Some differentiation present but unique value proposition needs clarification"
      },
      scalability: {
        score: scores.scalability,
        reasoning: "Business model shows potential for growth with proper execution"
      },
      competition: {
        score: scores.competition,
        reasoning: "Competitive landscape awareness present but analysis could be deeper"
      },
      business_viability: {
        score: scores.business_viability,
        reasoning: "Revenue model concept is sound but needs detailed financial planning"
      },
      adoption_potential: {
        score: scores.adoption_potential,
        reasoning: "Clear value proposition should drive adoption but barriers need consideration"
      },
      risk_assessment: {
        score: scores.risk_assessment,
        reasoning: "Standard execution and market risks, manageable with proper planning"
      },
      impact_potential: {
        score: scores.impact_potential,
        reasoning: "Could provide meaningful value but broader impact needs articulation"
      }
    },
    overall_score: overall_score,
    summary: "This idea shows promise with a clear problem focus and potential market opportunity. The key next steps involve market validation, competitive analysis, and developing a detailed business model to strengthen the foundation for success."
  };
}
