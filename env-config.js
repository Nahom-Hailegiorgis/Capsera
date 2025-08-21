// env-config.js - Environment configuration loader
// This file loads environment variables and makes them available to the client-side code

// In a production environment, you would typically load these from your build process
// or server-side injection. For development, we'll define them here.

window.ENV = {
  SUPABASE_URL: "https://cboescovlebokpnrsnwp.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNib2VzY292bGVib2twbnJzbndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjc0ODAsImV4cCI6MjA3MDcwMzQ4MH0.2mrbRIp7A14hRs_mz37sPshZOrmt0uT9UsM0JWRSvx0",

  EUREKA: true,
  EDGE_FUNCTION_URL: "https://cboescovlebokpnrsnwp.supabase.co/functions/v1",
};

console.log("Environment configuration loaded");
