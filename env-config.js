<script>
  window.ENV = {
    SUPABASE_URL: "{{ SUPABASE_URL }}",
    SUPABASE_ANON_KEY: "{{ SUPABASE_ANON_KEY }}",
    OPENAI_API_KEY: "{{ OPENAI_API_KEY }}",
    GOOGLE_TRANSLATE_KEY: "{{ GOOGLE_TRANSLATE_KEY }}",
    EUREKA: {{ EUREKA }},
    EDGE_FUNCTION_URL: "{{ EDGE_FUNCTION_URL }}"
  };

  console.log("Environment configuration loaded");
</script>
