const fs = require("fs");

const content = `
window.ENV = {
  SUPABASE_URL: "${process.env.SUPABASE_URL}",
  SUPABASE_ANON_KEY: "${process.env.SUPABASE_ANON_KEY}",
  OPENAI_API_KEY: "${process.env.OPENAI_API_KEY}",
  GOOGLE_TRANSLATE_KEY: "${process.env.GOOGLE_TRANSLATE_KEY}",
  EUREKA: ${process.env.EUREKA || true},
  EDGE_FUNCTION_URL: "${process.env.EDGE_FUNCTION_URL || process.env.SUPABASE_URL + '/functions/v1'}"
};
`;

fs.writeFileSync("env-config.js", content);
console.log("env-config.js generated");
