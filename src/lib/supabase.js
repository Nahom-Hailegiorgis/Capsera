import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Generate or get device ID
export const getDeviceId = () => {
  let deviceId = localStorage.getItem("capsera_device_id");
  if (!deviceId) {
    deviceId =
      "device_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("capsera_device_id", deviceId);
  }
  return deviceId;
};

// Check for submission rate limit
export const canSubmit = () => {
  const lastSubmission = localStorage.getItem("capsera_last_submission");
  if (!lastSubmission) return true;

  const timeSinceLastSubmission = Date.now() - parseInt(lastSubmission);
  return timeSinceLastSubmission >= 60000; // 1 minute
};

// Get remaining wait time
export const getRemainingWaitTime = () => {
  const lastSubmission = localStorage.getItem("capsera_last_submission");
  if (!lastSubmission) return 0;

  const timeSinceLastSubmission = Date.now() - parseInt(lastSubmission);
  const remaining = 60000 - timeSinceLastSubmission;
  return remaining > 0 ? remaining : 0;
};

// Set last submission time
export const setLastSubmissionTime = () => {
  localStorage.setItem("capsera_last_submission", Date.now().toString());
};

// Save draft
export const saveDraft = (formData) => {
  localStorage.setItem("capsera_draft", JSON.stringify(formData));
};

// Get draft
export const getDraft = () => {
  const draft = localStorage.getItem("capsera_draft");
  return draft ? JSON.parse(draft) : null;
};

// Clear draft
export const clearDraft = () => {
  localStorage.removeItem("capsera_draft");
};
