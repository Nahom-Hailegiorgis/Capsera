// edge-functions/get-idea-details.js
// Enhanced Supabase Edge Function with comprehensive security, structured AI feedback support, and orphan prevention

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.js";

// Process AI feedback with enhanced validation
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

    // 5. Enhanced Fetch Idea Details with Orphan Prevention and New Fields
    console.log(`🔐 [${requestId}] Fetching idea details for: ${idea_id}`);

    const { data, error } = await supabase
      .from("ideas")
      .select(
        `
        id,
        device_id,
        full_name,
        user_uuid,
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
        draft_number,
        previous_score,
        first_draft_submitted_at,
        last_submission_at,
        created_at,
        users!user_uuid (
          id,
          full_name,
          deleted_at
        )
      `
      )
      .eq("id", idea_id)
      .eq("is_final", true) // Only return final submissions
      .limit(1)
      .single();

    // 6. Handle Database Response with Orphan Checking
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

    // 7. Orphan Prevention Check - Verify user still exists and is not deleted
    if (data.user_uuid && data.users && data.users.deleted_at) {
      console.log(`🔐 [${requestId}] Idea belongs to deleted user, hiding: ${idea_id}`);

      return new Response(
        JSON.stringify({
          error: "not_found",
          message: "Idea not found or not available",
          request_id: requestId,
          reason: "user_deleted", // For debugging only, not shown to end users
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

    // 8. Data Processing and Sanitization with Enhanced AI Feedback Support
    const processedData = {
      ...data,
      // Remove user join data from response (keep only basic info)
      users: undefined,
      // Ensure category is properly formatted as array
      category: Array.isArray(data.category)
        ? data.category
        : data.category
        ? [data.category]
        : [],
      // Process AI feedback
      ai_feedback: data.ai_feedback
        ? processAIFeedback(data.ai_feedback)
        : null,
      // Add metadata
      access_level: "full",
      retrieved_at: new Date().toISOString(),
      request_id: requestId,
    };

    // 9. Comprehensive Logging with Enhanced Tracking Info
    const processingTime = Date.now() - startTime;
    const aiScore =
      data.ai_feedback?.overall_score || data.ai_feedback?.score || "N/A";

    console.log(`🔐 [${requestId}] Idea details accessed successfully`);
    console.log(`🔐 [${requestId}] Idea: ${idea_id} by ${data.full_name}`);
    console.log(`🔐 [${requestId}] Draft: ${data.draft_number || 1}, Previous score: ${data.previous_score || "N/A"}`);
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
    console.log(`🔐 [${requestId}] User UUID: ${data.user_uuid || "none"}`);
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
          draft_number: data.draft_number || 1,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (logError) {
      // Log errors are non-critical
      console.warn(`🔐 [${requestId}] Failed to log access:`, logError);
    }

    // 10. Return Success Response
    return new Response(JSON.stringify(processedData), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        "X-Processing-Time": `${processingTime}ms`,
        "Cache-Control": "private, max-age=300, must-revalidate",
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
