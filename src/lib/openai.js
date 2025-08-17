const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export const evaluateIdea = async (ideaData) => {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an AI evaluator for Capsera, a platform for product ideas. Evaluate submissions for:

1. SPAM: Marketing, promotional content, unrelated topics, nonsense
2. DUPLICATES: Compare against existing ideas (you'll be provided context)
3. PRIVACY: Personal information like emails, phones, addresses, social security numbers
4. QUALITY: Rate viable product ideas 0-100 based on innovation, feasibility, market need

Respond ONLY with valid JSON:
{
  "valid": boolean,
  "reason": "spam|duplicate|privacy|allowed",
  "score": number (0-100, only if valid),
  "explanation": "brief explanation"
}`,
          },
          {
            role: "user",
            content: `Evaluate this product idea submission:

Name: ${ideaData.fullName}
Who They Serve: ${ideaData.whoToServe}
Product Idea: ${ideaData.productIdea}
Pain Points: ${ideaData.userPainPoints || "Not provided"}
Alternatives: ${ideaData.existingAlternatives || "Not provided"}
User Capabilities: ${ideaData.userCapabilities || "Not provided"}
Categories: ${ideaData.categories?.join(", ") || "None"}
Source: ${ideaData.source}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return {
      valid: result.valid,
      reason: result.reason,
      score: result.score || 0,
      explanation: result.explanation,
    };
  } catch (error) {
    console.error("OpenAI evaluation error:", error);
    throw new Error(`AI evaluation failed: ${error.message}`);
  }
};

export const evaluateFeedback = async (feedbackText) => {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Evaluate feedback for spam. Reject if it contains:
- Marketing/promotional content
- Unrelated topics
- Nonsense/gibberish
- Offensive content

Respond ONLY with valid JSON:
{
  "valid": boolean,
  "reason": "spam|allowed"
}`,
          },
          {
            role: "user",
            content: `Evaluate this feedback: ${feedbackText}`,
          },
        ],
        max_tokens: 50,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return {
      valid: result.valid,
      reason: result.reason,
    };
  } catch (error) {
    console.error("OpenAI feedback evaluation error:", error);
    throw new Error(`Feedback evaluation failed: ${error.message}`);
  }
};
