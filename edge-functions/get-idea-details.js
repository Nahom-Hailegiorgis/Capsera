// edge-functions/get-idea-details.js
// Enhanced Supabase Edge Function with comprehensive security and structured AI feedback support

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.js"; // ✅ Fixed: Changed from .ts to .js

// ✅ Fixed: Move processAIFeedback outside of serve function
function processAIFeedback(aiFeedback) {
  if (!aiFeedback) return null;

  // If it's already structured format (has critique, suggestions, grading), return as-is
  if (aiFeedback.critique && aiFeedback.suggestions && aiFeedback.grading) {
    return {
      ...aiFeedback,
      feedback_type: "structured",
      processed_at: new Date().toISOString(),
    };
  }

  // If it's legacy format, mark it as such but preserve original data
  if (aiFeedback.score && typeof aiFeedback.score === "number") {
    return {
      ...aiFeedback,
      feedback_type: "legacy",
      processed_at: new Date().toISOString(),
    };
  }

  // Unknown format, preserve as-is with warning
  console.warn(`Unknown AI feedback format detected`);
  return {
    ...aiFeedback,
    feedback_type: "unknown",
    processed_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);

  console.log(`🔐 [${requestId}] Idea details request received`);

  try {
    // 1. EUREKA Environment Check - Primary Security Gate
    const EUREKA = Deno.env.get("EUREKA");
    const isEurekaEnabled = EUREKA === "true" || EUREKA === "1";

    console.log(
      `🔐 [${requestId}] EUREKA status: ${EUREKA} (enabled: ${isEurekaEnabled})`
    );

    if (!isEurekaEnabled) {
      console.log(`🔐 [${requestId}] Access denied - EUREKA disabled`);

      return new Response(
        JSON.stringify({
          detail_restricted: true,
          message: "Detailed view is not available at this time",
          access_level: "restricted",
          reason: "feature_disabled",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }
      );
    }

    // 2. Parse and Validate Request Parameters
    const url = new URL(req.url);
    const idea_id = url.searchParams.get("idea_id");
    const clientIP =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    console.log(
      `🔐 [${requestId}] Request from IP: ${clientIP}, idea_id: ${idea_id}`
    );

    if (!idea_id) {
      console.log(`🔐 [${requestId}] Missing idea_id parameter`);

      return new Response(
        JSON.stringify({
          error: "missing_parameter",
          message: "idea_id parameter is required",
          request_id: requestId,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }
      );
    }

    // 3. Validate UUID Format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idea_id)) {
      console.log(`🔐 [${requestId}] Invalid UUID format: ${idea_id}`);

      return new Response(
        JSON.stringify({
          error: "invalid_format",
          message: "idea_id must be a valid UUID",
          request_id: requestId,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }
      );
    }

    // 4. Initialize Supabase Client with Service Role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`🔐 [${requestId}] Missing Supabase configuration`);
      console.error(
        `🔐 [${requestId}] URL present: ${!!supabaseUrl}, Service Key present: ${!!supabaseServiceKey}`
      );

      return new Response(
        JSON.stringify({
          error: "server_configuration",
          message: "Server configuration error",
          request_id: requestId,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }
      );
    }

    // Create Supabase client with elevated permissions
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          "X-Request-ID": requestId,
        },
      },
    });

    console.log(`🔐 [${requestId}] Supabase client initialized`);

    // 5. Fetch Idea Details with Security Filters
    console.log(`🔐 [${requestId}] Fetching idea details for: ${idea_id}`);

    const { data, error } = await supabase
      .from("ideas")
      .select(
        `
        id,
        device_id,
        full_name,
        version,
        is_final,
        ideal_customer_profile,
        product_idea,
        pain_points,
        alternatives,
        category,
        heard_about,
        ai_feedback,
        quality_score,
        created_at
      `
      )
      .eq("id", idea_id)
      .eq("is_final", true) // Only return final submissions
      .limit(1)
      .single();

    // 6. Handle Database Response
    if (error) {
      console.error(`🔐 [${requestId}] Database error:`, error);

      if (error.code === "PGRST116") {
        // No rows found
        console.log(
          `🔐 [${requestId}] Idea not found or not final: ${idea_id}`
        );

        return new Response(
          JSON.stringify({
            error: "not_found",
            message: "Idea not found or not available",
            request_id: requestId,
          }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "X-Request-ID": requestId,
            },
          }
        );
      }

      // Other database errors
      return new Response(
        JSON.stringify({
          error: "database_error",
          message: "Failed to retrieve idea details",
          request_id: requestId,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }
      );
    }

    if (!data) {
      console.log(`🔐 [${requestId}] No data returned for idea: ${idea_id}`);

      return new Response(
        JSON.stringify({
          error: "not_found",
          message: "Idea not found",
          request_id: requestId,
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }
      );
    }

    // 7. Data Processing and Sanitization with Enhanced AI Feedback Support
    const processedData = {
      ...data,
      // Ensure category is properly formatted as array
      category: Array.isArray(data.category)
        ? data.category
        : data.category
        ? [data.category]
        : [],
      // ✅ Fixed: Removed 'this.' and call function directly
      ai_feedback: data.ai_feedback
        ? processAIFeedback(data.ai_feedback)
        : null,
      // Add metadata
      access_level: "full",
      retrieved_at: new Date().toISOString(),
      request_id: requestId,
    };

    // 8. Comprehensive Logging with AI Feedback Details
    const processingTime = Date.now() - startTime;
    const aiScore =
      data.ai_feedback?.overall_score || data.ai_feedback?.score || "N/A";

    console.log(`🔐 [${requestId}] Idea details accessed successfully`);
    console.log(`🔐 [${requestId}] Idea: ${idea_id} by ${data.full_name}`);
    console.log(`🔐 [${requestId}] Quality score: ${data.quality_score}/100`);
    console.log(`🔐 [${requestId}] AI score: ${aiScore}/100`);
    console.log(
      `🔐 [${requestId}] AI feedback type: ${
        data.ai_feedback?.critique ? "structured" : "legacy"
      }`
    );
    console.log(
      `🔐 [${requestId}] Categories: ${JSON.stringify(data.category)}`
    );
    console.log(`🔐 [${requestId}] Client IP: ${clientIP}`);
    console.log(`🔐 [${requestId}] Processing time: ${processingTime}ms`);

    // Optional: Log to analytics table (if exists)
    try {
      await supabase.from("access_logs").insert([
        {
          request_id: requestId,
          idea_id: idea_id,
          client_ip: clientIP,
          user_agent: req.headers.get("user-agent") || "unknown",
          access_granted: true,
          processing_time_ms: processingTime,
          ai_feedback_type: data.ai_feedback?.critique
            ? "structured"
            : "legacy",
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (logError) {
      // Log errors are non-critical
      console.warn(`🔐 [${requestId}] Failed to log access:`, logError);
    }

    // 9. Return Success Response
    return new Response(JSON.stringify(processedData), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        "X-Processing-Time": `${processingTime}ms`,
        "Cache-Control": "private, max-age=300, must-revalidate", // 5 minutes cache
        Vary: "Authorization",
      },
    });
  } catch (err) {
    const processingTime = Date.now() - startTime;

    console.error(`🔐 [${requestId}] Unexpected error:`, err);
    console.error(`🔐 [${requestId}] Error stack:`, err.stack);
    console.error(
      `🔐 [${requestId}] Processing time before error: ${processingTime}ms`
    );

    // Log critical errors
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        await supabase.from("error_logs").insert([
          {
            request_id: requestId,
            error_type: "edge_function_error",
            error_message: err.message,
            error_stack: err.stack,
            client_ip: req.headers.get("x-forwarded-for") || "unknown",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (logError) {
      console.error(`🔐 [${requestId}] Failed to log error:`, logError);
    }

    return new Response(
      JSON.stringify({
        error: "internal_server_error",
        message: "An unexpected error occurred",
        request_id: requestId,
        processing_time_ms: processingTime,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
          "X-Processing-Time": `${processingTime}ms`,
        },
      }
    );
  }
});
