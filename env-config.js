// env-config.js
window.ENV = {
  SUPABASE_URL: "__SUPABASE_URL__",
  SUPABASE_ANON_KEY: "__SUPABASE_ANON_KEY__",
  OPENAI_API_KEY: "__OPENAI_API_KEY__",
  GOOGLE_TRANSLATE_KEY: "__GOOGLE_TRANSLATE_KEY__",
  EUREKA: true,
  EDGE_FUNCTION_URL: "__EDGE_FUNCTION_URL__",
};

console.log("__SUPABASE_URL__");
console.log("Environment configuration loaded");
