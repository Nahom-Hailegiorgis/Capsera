// scripts/generate-env.js
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '..', 'env-config.js'); // write to project root so index.html can load /env-config.js

const env = {
  SUPABASE_URL: process.env.SUPABASE_URL || null,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || null,
  // WARNING: OPENAI_API_KEY is a secret. Only include if you intentionally want it client-side.
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || null,
  GOOGLE_TRANSLATE_KEY: process.env.GOOGLE_TRANSLATE_KEY || null,
  EUREKA:
    typeof process.env.EUREKA === 'undefined'
      ? true
      : process.env.EUREKA === 'true' || process.env.EUREKA === '1',
  EDGE_FUNCTION_URL:
    process.env.EDGE_FUNCTION_URL ||
    (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1` : null)
};

const content = `window.ENV = ${JSON.stringify(env, null, 2)};\n`;
fs.writeFileSync(outPath, content, { encoding: 'utf8' });
console.log(`Generated ${outPath}`);
