// supabase.js - Supabase client configuration with enhanced structured AI grading
import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.39.3";

// Get config from environment variables or use placeholders
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;
const EDGE_FUNCTION_URL = window.ENV.EDGE_FUNCTION_URL;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase URL and ANON key are required!");
}

// Create Supabase client with anonymous access
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const supabaseHelper = {
  // Get public ideas (summary view only)
  async getPublicIdeas() {
    try {
      const { data, error } = await supabase
        .from("ideas_public")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching ideas:", error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Error in getPublicIdeas:", error);
      return [];
    }
  },

  // Get idea details (via Edge Function for EUREKA check)
  // Add this debug version to your supabase.js getIdeaDetails method
  async getIdeaDetails(ideaId) {
    console.log("🔍 DEBUG: Starting getIdeaDetails for:", ideaId);
    console.log("🔍 DEBUG: EDGE_FUNCTION_URL:", EDGE_FUNCTION_URL);

    try {
      const url = `${EDGE_FUNCTION_URL}/get-idea-details?idea_id=${ideaId}`;
      console.log("🔍 DEBUG: Full request URL:", url);

      // Call secure Edge Function
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
      });

      console.log("🔍 DEBUG: Response status:", response.status);
      console.log("🔍 DEBUG: Response ok:", response.ok);
      console.log(
        "🔍 DEBUG: Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (response.status === 403) {
        const data = await response.json();
        console.log("🔍 DEBUG: 403 response data:", data);
        return { restricted: true, message: "Detailed view not available" };
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log("🔍 DEBUG: Error response text:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("🔍 DEBUG: Success response data:", data);
      return { restricted: false, data };
    } catch (error) {
      console.error("🔍 DEBUG: Catch block error:", error);
      console.error("🔍 DEBUG: Error message:", error.message);
      console.error("🔍 DEBUG: Error stack:", error.stack);
      return {
        restricted: true,
        error: "Unable to load details",
        message: "No sneak peeks!",
      };
    }
  },

  // Submit final idea (attempt 3) - Fixed with proper schema
  async submitFinalIdea(submission) {
    console.log("🔧 SUPABASE DEBUG: Submitting final idea", submission);

    try {
      const { data, error } = await supabase
        .from("ideas")
        .insert([
          {
            device_id: submission.device_id,
            full_name: submission.full_name,
            version: submission.version || 3,
            is_final: true,
            ideal_customer_profile: submission.ideal_customer_profile,
            product_idea: submission.product_idea,
            pain_points: submission.pain_points,
            alternatives: submission.alternatives,
            category: submission.category || [],
            heard_about: submission.heard_about,
            ai_feedback: submission.ai_feedback, // Now contains structured critique and grading
            quality_score: submission.quality_score,
          },
        ])
        .select();

      if (error) {
        console.error("🔧 SUPABASE DEBUG: Error submitting idea:", error);
        throw error;
      }

      console.log(
        "🔧 SUPABASE DEBUG: Final idea submitted successfully:",
        data
      );
      return data?.[0];
    } catch (error) {
      console.error("🔧 SUPABASE DEBUG: Error in submitFinalIdea:", error);
      throw error;
    }
  },

  // Create user after successful final submission
  async createUser(fullName) {
    try {
      const { data, error } = await supabase
        .from("users")
        .insert([{ full_name: fullName }])
        .select();

      if (error) {
        // User might already exist, which is fine
        console.warn("User creation warning:", error);
        return null;
      }

      return data?.[0];
    } catch (error) {
      console.error("Error in createUser:", error);
      return null;
    }
  },

  // Submit feedback - Enhanced
  // Replace the submitFeedback method in supabase.js with this enhanced version

  async submitFeedback(feedbackData) {
    console.log("🔧 SUPABASE: Starting feedback submission", {
      device_id: feedbackData.device_id,
      message_length: feedbackData.message?.length,
      anonymous: feedbackData.anonymous,
    });

    try {
      // Validate data
      if (!feedbackData.message || typeof feedbackData.message !== "string") {
        throw new Error("Message is required");
      }

      console.log("🔧 SUPABASE: Inserting into feedback table");

      const { data, error } = await supabase
        .from("feedback")
        .insert([
          {
            device_id: feedbackData.device_id || null,
            message: feedbackData.message,
            contact_info: feedbackData.contact_info || null,
            anonymous: feedbackData.anonymous,
          },
        ])
        .select();

      if (error) {
        console.error("🔧 SUPABASE: Database error:", error);

        if (error.code === "42501") {
          throw new Error(
            "Permission denied - RLS policy violation. Please check Supabase policies."
          );
        }

        throw new Error(`Database error: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No data returned from insert");
      }

      console.log("🔧 SUPABASE: Success!", {
        id: data[0].id,
        created_at: data[0].created_at,
      });

      return data[0];
    } catch (error) {
      console.error("🔧 SUPABASE: Error:", error);
      throw error;
    }
  },
  // Also add a method to check feedback submission status
  async checkFeedbackConnection() {
    try {
      console.log("🔧 SUPABASE FEEDBACK: Testing connection");

      const { data, error } = await supabase
        .from("feedback")
        .select("id")
        .limit(1);

      if (error) {
        console.error("🔧 SUPABASE FEEDBACK: Connection test failed:", error);
        return false;
      }

      console.log("🔧 SUPABASE FEEDBACK: Connection test successful");
      return true;
    } catch (error) {
      console.error("🔧 SUPABASE FEEDBACK: Connection test error:", error);
      return false;
    }
  },

  // Get all users (for settings screen)
  async getAllUsers() {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching users:", error);
        // Return empty array on error since this is for display only
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error in getAllUsers:", error);
      return [];
    }
  },

  // Delete user (would need additional logic for PIN verification)
  async deleteUser(fullName) {
    try {
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("full_name", fullName);

      if (error) {
        console.error("Error deleting user:", error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error("Error in deleteUser:", error);
      throw error;
    }
  },

  // Check connection status
  async checkConnection() {
    try {
      const { data, error } = await supabase
        .from("ideas_public")
        .select("count")
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  },

  // Enhanced OpenAI integration with structured critique and grading
  async getAIFeedback(submission) {
    const OPENAI_API_KEY = window.ENV.OPENAI_API_KEY;

    if (!OPENAI_API_KEY || OPENAI_API_KEY === "TODO_FILL_OPENAI_API_KEY") {
      console.warn("OpenAI API key not configured");
      return this.getMockAIFeedback();
    }

    try {
      const categoriesText = Array.isArray(submission.category)
        ? submission.category.join(", ")
        : submission.category || "None";

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            temperature: 0.3,
            messages: [
              {
                role: "system",
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

Be honest and constructive. Focus on specific, actionable insights.`,
              },
              {
                role: "user",
                content: `Please analyze this startup idea:

TARGET CUSTOMER: ${submission.ideal_customer_profile}

PRODUCT IDEA: ${submission.product_idea}

PAIN POINTS ADDRESSED: ${submission.pain_points}

EXISTING ALTERNATIVES: ${submission.alternatives}

CATEGORIES: ${categoriesText}

Provide structured critique, suggestions, and detailed grading for each criterion.`,
              },
            ],
            max_tokens: 3000,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();

      // Parse JSON response
      const feedback = JSON.parse(content);

      // Validate structure
      if (
        !feedback.critique ||
        !feedback.suggestions ||
        !feedback.grading ||
        typeof feedback.overall_score !== "number"
      ) {
        throw new Error("Invalid AI response format");
      }

      // Calculate overall score from individual scores if not provided or seems wrong
      const scores = Object.values(feedback.grading).map((item) => item.score);
      const calculatedScore = Math.round(
        (scores.reduce((a, b) => a + b, 0) / scores.length) * 10
      );

      if (Math.abs(feedback.overall_score - calculatedScore) > 15) {
        feedback.overall_score = calculatedScore;
      }

      console.log(
        "🔧 AI FEEDBACK DEBUG: Generated structured feedback with score:",
        feedback.overall_score
      );
      return feedback;
    } catch (error) {
      console.error("AI feedback error:", error);
      return this.getMockAIFeedback();
    }
  },

  // Updated mock AI feedback with structured format
  getMockAIFeedback() {
    const scores = {
      problem_significance: Math.floor(Math.random() * 4) + 5, // 5-8
      target_audience: Math.floor(Math.random() * 4) + 4, // 4-7
      uniqueness: Math.floor(Math.random() * 5) + 3, // 3-7
      scalability: Math.floor(Math.random() * 4) + 4, // 4-7
      competition: Math.floor(Math.random() * 5) + 3, // 3-7
      business_viability: Math.floor(Math.random() * 4) + 4, // 4-7
      adoption_potential: Math.floor(Math.random() * 5) + 4, // 4-8
      risk_assessment: Math.floor(Math.random() * 3) + 5, // 5-7
      impact_potential: Math.floor(Math.random() * 4) + 4, // 4-7
    };

    const overall_score = Math.round(
      (Object.values(scores).reduce((a, b) => a + b, 0) / 9) * 10
    );

    return {
      critique: {
        strengths: [
          "Addresses a clear and identifiable problem in the target market",
          "Shows understanding of customer pain points and needs",
          "Has potential for differentiation from existing solutions",
        ],
        weaknesses: [
          "Market size and validation needs more research and data",
          "Revenue model and unit economics require detailed analysis",
          "Competitive positioning could be stronger and more specific",
        ],
      },
      suggestions: [
        "Conduct customer interviews to validate problem significance and willingness to pay",
        "Research and analyze both direct and indirect competitors more thoroughly",
        "Develop a minimum viable product (MVP) to test core assumptions",
        "Create detailed financial projections including customer acquisition costs",
      ],
      grading: {
        problem_significance: {
          score: scores.problem_significance,
          reasoning:
            "Problem is relevant but needs stronger evidence of market demand",
        },
        target_audience: {
          score: scores.target_audience,
          reasoning:
            "Target audience is identifiable but could be more specific and segmented",
        },
        uniqueness: {
          score: scores.uniqueness,
          reasoning:
            "Some differentiation present but unique value proposition needs clarification",
        },
        scalability: {
          score: scores.scalability,
          reasoning:
            "Business model shows potential for growth with proper execution",
        },
        competition: {
          score: scores.competition,
          reasoning:
            "Competitive landscape awareness present but analysis could be deeper",
        },
        business_viability: {
          score: scores.business_viability,
          reasoning:
            "Revenue model concept is sound but needs detailed financial planning",
        },
        adoption_potential: {
          score: scores.adoption_potential,
          reasoning:
            "Clear value proposition should drive adoption but barriers need consideration",
        },
        risk_assessment: {
          score: scores.risk_assessment,
          reasoning:
            "Standard execution and market risks, manageable with proper planning",
        },
        impact_potential: {
          score: scores.impact_potential,
          reasoning:
            "Could provide meaningful value but broader impact needs articulation",
        },
      },
      overall_score: overall_score,
      summary:
        "This idea shows promise with a clear problem focus and potential market opportunity. The key next steps involve market validation, competitive analysis, and developing a detailed business model to strengthen the foundation for success.",
    };
  },
};
