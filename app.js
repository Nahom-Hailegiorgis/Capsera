// app.js - Main Capsera PWA application
import { dbHelper } from "./db.js";
import { supabaseHelper } from "./supabase.js";
import { validation } from "./validation.js";
import { translator } from "./translate.js";

class CapseraApp {
  constructor() {
    this.currentScreen = "ideas";
    this.currentUser = null;
    this.currentProject = null;
    this.currentLanguage = "en";
    this.translations = null;
    this.ideas = [];
    this.isOnline = navigator.onLine;

    this.init();
  }

  async init() {
    // Set up event listeners
    this.setupEventListeners();

    // Register service worker
    await this.registerServiceWorker();

    // Initialize translations
    this.translations = await translator.init();

    // Load initial data
    await this.loadIdeasScreen();

    // Show initial screen
    this.showScreen("ideas");

    // Set up periodic sync
    setInterval(() => this.syncOfflineData(), 30000); // Every 30 seconds
  }

  setupEventListeners() {
    // Wait for DOM to be ready before setting up listeners
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.setupDOMEventListeners();
      });
    } else {
      this.setupDOMEventListeners();
    }

    // Online/offline detection
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.syncOfflineData();
      this.showMessage("Connection restored", "success");
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.showMessage("Working offline", "warning");
    });

    // Service worker messages
    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "SYNC_OFFLINE_DATA") {
          this.syncOfflineData();
        }
      });
    }
  }

  setupDOMEventListeners() {
    // Navigation tabs
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        const screen =
          e.target.getAttribute("data-screen") ||
          e.target.closest("[data-screen]")?.getAttribute("data-screen");
        if (screen) {
          this.showScreen(screen);
        }
      });
    });
  }

  async registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("SW registered:", registration);
      } catch (error) {
        console.error("SW registration failed:", error);
      }
    }
  }

  showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });

    // Remove active from all tabs
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.classList.remove("active");
    });

    // Show selected screen and tab
    const screenElement = document.getElementById(`${screenName}-screen`);
    const tabElement = document.querySelector(`[data-screen="${screenName}"]`);

    if (screenElement) {
      screenElement.classList.add("active");
    }
    if (tabElement) {
      tabElement.classList.add("active");
    }

    this.currentScreen = screenName;

    // Load screen-specific data
    switch (screenName) {
      case "ideas":
        this.loadIdeasScreen();
        break;
      case "submissions":
        this.loadSubmissionsScreen();
        break;
      case "submit":
        this.loadSubmitScreen();
        break;
      case "settings":
        this.loadSettingsScreen();
        break;
    }
  }

  // Screen 1: Ideas List
  async loadIdeasScreen() {
    const container = document.getElementById("ideas-list");
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading ideas...</div>';

    try {
      // Try to get fresh data if online, otherwise use cache
      if (this.isOnline) {
        this.ideas = await supabaseHelper.getPublicIdeas();
        await dbHelper.cacheIdeas(this.ideas);
      } else {
        const cached = await dbHelper.getCachedIdeas();
        this.ideas = cached || [];
      }

      this.renderIdeasList();
      this.setupFeedbackForm();
    } catch (error) {
      console.error("Error loading ideas:", error);
      container.innerHTML = '<div class="error">Failed to load ideas</div>';
    }
  }

  renderIdeasList() {
    const container = document.getElementById("ideas-list");
    if (!container) return;

    if (this.ideas.length === 0) {
      container.innerHTML = '<div class="text-center">No ideas found</div>';
      return;
    }

    const html = this.ideas
      .map(
        (idea) => `
      <div class="idea-item" onclick="app.viewIdeaDetails('${idea.id}')">
        <div class="idea-title">${this.escapeHtml(
          idea.preview || "Untitled Idea"
        )}</div>
        <div class="idea-meta">
          By ${this.escapeHtml(idea.full_name)} • ${
          Array.isArray(idea.category)
            ? idea.category.join(", ")
            : idea.category || "Uncategorized"
        } • 
          ${new Date(idea.created_at).toLocaleDateString()}
        </div>
      </div>
    `
      )
      .join("");

    container.innerHTML = html + this.getFeedbackFormHTML();
  }

  getFeedbackFormHTML() {
    return `
      <div class="feedback-section">
        <h3>Share Your Feedback</h3>
        <form id="feedback-form" class="feedback-form">
          <div class="form-group">
            <label class="form-label">How can we improve Capsera?</label>
            <textarea id="feedback-message" class="form-textarea" 
                     placeholder="Tell us what you think..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Contact (Optional)</label>
            <input type="text" id="feedback-contact" class="form-input" 
                   placeholder="Email or phone (optional)">
          </div>
          <button type="submit" class="btn btn-primary">Submit Feedback</button>
        </form>
      </div>
    `;
  }

  // ========================================
  // 1. UPDATED app.js methods (simplified feedback to Supabase only)
  // ========================================

  // Updated setupFeedbackForm method in CapseraApp class
  // ========================================
  // 1. SIMPLIFIED app.js setupFeedbackForm method (direct to Supabase only)
  // ========================================

  // Updated setupFeedbackForm method in CapseraApp class
  setupFeedbackForm() {
    console.log("🔧 FEEDBACK: Setting up feedback form");

    const form = document.getElementById("feedback-form");
    if (!form) {
      console.error("🔧 FEEDBACK: Form element not found!");
      return;
    }

    // Remove existing listeners to avoid duplicates
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    console.log("🔧 FEEDBACK: Form listener attached successfully");

    newForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("🔧 FEEDBACK: Form submission started");

      const messageInput = document.getElementById("feedback-message");
      const contactInput = document.getElementById("feedback-contact");
      const submitButton = newForm.querySelector('button[type="submit"]');

      const message = messageInput?.value?.trim();
      const contact = contactInput?.value?.trim();

      console.log("🔧 FEEDBACK: Form data", {
        messageLength: message?.length || 0,
        hasContact: !!contact,
      });

      if (!message) {
        this.showMessage("Please enter your feedback message", "error");
        return;
      }

      // Show loading state
      const originalText = submitButton?.textContent || "Submit Feedback";
      if (submitButton) {
        submitButton.textContent = "Submitting...";
        submitButton.disabled = true;
      }

      try {
        // Prepare feedback data
        const feedbackData = {
          device_id: dbHelper.getDeviceId(),
          message: message,
          contact_info: contact || null,
          anonymous: !contact,
        };

        console.log("🔧 FEEDBACK: Submitting to Supabase", {
          device_id: feedbackData.device_id,
          message_length: feedbackData.message.length,
          anonymous: feedbackData.anonymous,
        });

        // Submit directly to Supabase
        const result = await supabaseHelper.submitFeedback(feedbackData);

        console.log("🔧 FEEDBACK: Success!", {
          id: result.id,
          created_at: result.created_at,
        });

        this.showMessage("Thank you for your feedback!", "success");
        newForm.reset();
      } catch (error) {
        console.error("🔧 FEEDBACK: Failed:", error);

        // Show user-friendly error message
        let errorMessage = "Failed to submit feedback. Please try again.";
        if (error.message.includes("policy")) {
          errorMessage = "Permission error - please contact support.";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error - check your connection.";
        }

        this.showMessage(errorMessage, "error");
      } finally {
        // Reset button
        if (submitButton) {
          submitButton.textContent = originalText;
          submitButton.disabled = false;
        }
      }
    });
  }

  // ========================================
  // 2. UPDATED supabase.js submitFeedback method (direct to public.feedback table)
  // ========================================

  // Submit feedback directly to Supabase public.feedback table
  async submitFeedback(feedbackData) {
    console.log("🔧 SUPABASE: Submitting to public.feedback table");
    console.log("🔧 SUPABASE: Data being submitted:", {
      device_id: feedbackData.device_id,
      message_length: feedbackData.message?.length,
      contact_info: feedbackData.contact_info,
      anonymous: feedbackData.anonymous,
    });

    try {
      // Validate data matches your table schema
      if (!feedbackData.message || typeof feedbackData.message !== "string") {
        throw new Error("message is required and must be a string");
      }

      if (typeof feedbackData.anonymous !== "boolean") {
        feedbackData.anonymous = !feedbackData.contact_info; // default logic
      }

      console.log("🔧 SUPABASE: Calling supabase.from('feedback').insert()");

      const { data, error } = await supabase
        .from("feedback") // This matches your public.feedback table
        .insert([
          {
            device_id: feedbackData.device_id || null,
            message: feedbackData.message,
            contact_info: feedbackData.contact_info || null,
            anonymous: feedbackData.anonymous,
            // id and created_at will be auto-generated by Supabase
          },
        ])
        .select(); // Return the inserted record

      if (error) {
        console.error("🔧 SUPABASE: Insert error:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No data returned from Supabase insert");
      }

      console.log("🔧 SUPABASE: Successfully inserted into public.feedback:", {
        id: data[0].id,
        created_at: data[0].created_at,
        device_id: data[0].device_id,
        anonymous: data[0].anonymous,
        message_length: data[0].message?.length,
      });

      return data[0]; // Return the inserted record with Supabase-generated id and created_at
    } catch (error) {
      console.error("🔧 SUPABASE: submitFeedback error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });

      // Provide user-friendly error messages
      if (
        error.message?.includes("network") ||
        error.message?.includes("fetch")
      ) {
        throw new Error(
          "Network connection failed. Please check your internet connection."
        );
      } else if (error.message?.includes("permission")) {
        throw new Error("Permission denied. Unable to submit feedback.");
      } else if (error.code === "23514") {
        throw new Error(
          "Feedback validation failed. Please check your message."
        );
      } else {
        throw new Error(`Failed to submit feedback: ${error.message}`);
      }
    }
  }

  // Test connection to feedback table
  async checkFeedbackConnection() {
    try {
      console.log("🔧 SUPABASE: Testing connection to feedback table");

      const { data, error } = await supabase
        .from("feedback")
        .select("id")
        .limit(1);

      if (error) {
        console.error("🔧 SUPABASE: Connection test failed:", error);
        return false;
      }

      console.log("🔧 SUPABASE: Connection test successful");
      return true;
    } catch (error) {
      console.error("🔧 SUPABASE: Connection test error:", error);
      return false;
    }
  }

  // ========================================
  // 3. DEBUGGING METHOD (add to app.js CapseraApp class)
  // ========================================

  // Debug the feedback system
  async debugFeedbackSystem() {
    console.log("🔧 DEBUG: Starting feedback system diagnosis");

    // Test Supabase connection
    try {
      const connected = await supabaseHelper.checkFeedbackConnection();
      console.log("🔧 DEBUG: Supabase connection:", connected);
    } catch (error) {
      console.error("🔧 DEBUG: Supabase connection error:", error);
    }

    // Check device ID
    const deviceId = dbHelper.getDeviceId();
    console.log("🔧 DEBUG: Device ID:", deviceId);

    // Test form elements
    const form = document.getElementById("feedback-form");
    const messageInput = document.getElementById("feedback-message");
    const contactInput = document.getElementById("feedback-contact");

    console.log("🔧 DEBUG: Form elements:", {
      form: !!form,
      messageInput: !!messageInput,
      contactInput: !!contactInput,
    });

    // Test a sample submission (without actually submitting)
    try {
      const testData = {
        device_id: deviceId,
        message: "Test message",
        contact_info: null,
        anonymous: true,
      };

      console.log("🔧 DEBUG: Test data prepared:", testData);
      console.log(
        "🔧 DEBUG: Ready to test submission (call app.testFeedbackSubmission() to actually test)"
      );
    } catch (error) {
      console.error("🔧 DEBUG: Error preparing test data:", error);
    }
  }

  // Test method to actually submit test feedback (optional)
  async testFeedbackSubmission() {
    console.log("🔧 TEST: Submitting test feedback");

    try {
      const testData = {
        device_id: dbHelper.getDeviceId(),
        message: "This is a test feedback message from the debug system",
        contact_info: null,
        anonymous: true,
      };

      const result = await supabaseHelper.submitFeedback(testData);
      console.log("🔧 TEST: Test submission successful:", result);
      this.showMessage("Test feedback submitted successfully!", "success");
    } catch (error) {
      console.error("🔧 TEST: Test submission failed:", error);
      this.showMessage(`Test failed: ${error.message}`, "error");
    }
  }

  // ========================================
  // 4. REMOVE these methods from app.js (since you don't want local storage)
  // ========================================

  /*
Remove these methods from your app.js since you don't want local storage:
- saveFeedbackLocally()
- syncFeedbackToSupabase() 
- syncOfflineData() (feedback parts)
- Any other local feedback storage related methods

Also remove these from db.js:
- saveFeedback()
- getPendingFeedback() 
- markFeedbackSynced()
- Any other feedback-related database methods
*/
  // Save feedback locally (for offline support)
  async saveFeedbackLocally(feedbackData) {
    console.log("🔧 FEEDBACK LOCAL: Starting local save");

    const feedbackWithMeta = {
      ...feedbackData,
      id:
        "feedback_" +
        Date.now() +
        "_" +
        Math.random().toString(36).substr(2, 9),
      status: "pending_sync",
      local_created_at: new Date().toISOString(),
    };

    console.log("🔧 FEEDBACK LOCAL: Generated local feedback object", {
      id: feedbackWithMeta.id,
      status: feedbackWithMeta.status,
      device_id: feedbackWithMeta.device_id,
      message_length: feedbackWithMeta.message.length,
    });

    try {
      await dbHelper.saveFeedback(feedbackWithMeta);
      console.log(
        "🔧 FEEDBACK LOCAL: Successfully saved locally:",
        feedbackWithMeta.id
      );
      return feedbackWithMeta;
    } catch (error) {
      console.error("🔧 FEEDBACK LOCAL: Local save failed:", error);
      throw error;
    }
  }

  // Background sync to Supabase (non-blocking)
  async syncFeedbackToSupabase(localFeedback) {
    console.log(
      "🔧 FEEDBACK SYNC: Starting Supabase sync for:",
      localFeedback.id
    );

    try {
      // Check network
      if (!navigator.onLine) {
        console.log("🔧 FEEDBACK SYNC: Offline, will sync later");
        return;
      }

      // Prepare data for Supabase public.feedback table
      const supabaseData = {
        device_id: localFeedback.device_id,
        message: localFeedback.message,
        contact_info: localFeedback.contact_info,
        anonymous: localFeedback.anonymous,
        // Note: id and created_at will be auto-generated by Supabase
      };

      console.log(
        "🔧 FEEDBACK SYNC: Sending to Supabase public.feedback table",
        {
          device_id: supabaseData.device_id,
          message_length: supabaseData.message.length,
          contact_info: supabaseData.contact_info,
          anonymous: supabaseData.anonymous,
        }
      );

      // Submit to Supabase
      const result = await supabaseHelper.submitFeedbackToSupabase(
        supabaseData
      );

      console.log("🔧 FEEDBACK SYNC: Supabase success", {
        supabase_id: result.id,
        created_at: result.created_at,
        local_id: localFeedback.id,
      });

      // Mark as synced locally
      await dbHelper.markFeedbackSynced(localFeedback.id);
      console.log(
        "🔧 FEEDBACK SYNC: Marked as synced in local storage:",
        localFeedback.id
      );
    } catch (error) {
      console.warn(
        "🔧 FEEDBACK SYNC: Sync failed (will retry later):",
        error.message
      );
    }
  }

  // Enhanced sync for all pending feedback
  async syncOfflineData() {
    if (!navigator.onLine) {
      console.log("🔧 SYNC ALL: Offline, skipping sync");
      return;
    }

    console.log("🔧 SYNC ALL: Starting sync of pending feedback");

    try {
      const pendingFeedback = await dbHelper.getPendingFeedback();
      console.log(
        "🔧 SYNC ALL: Found pending feedback:",
        pendingFeedback.length
      );

      let syncedCount = 0;
      let failedCount = 0;

      for (const feedback of pendingFeedback) {
        try {
          console.log("🔧 SYNC ALL: Syncing feedback:", feedback.id);

          const supabaseData = {
            device_id: feedback.device_id,
            message: feedback.message,
            contact_info: feedback.contact_info,
            anonymous: feedback.anonymous,
          };

          const result = await supabaseHelper.submitFeedbackToSupabase(
            supabaseData
          );
          await dbHelper.markFeedbackSynced(feedback.id);

          console.log(
            "🔧 SYNC ALL: Synced feedback:",
            feedback.id,
            "→",
            result.id
          );
          syncedCount++;
        } catch (error) {
          console.error("🔧 SYNC ALL: Failed to sync:", feedback.id, error);
          failedCount++;
        }
      }

      console.log("🔧 SYNC ALL: Sync complete", {
        synced: syncedCount,
        failed: failedCount,
        total: pendingFeedback.length,
      });

      if (syncedCount > 0) {
        this.showMessage(`Synced ${syncedCount} feedback items`, "success");
      }
    } catch (error) {
      console.error("🔧 SYNC ALL: Sync process error:", error);
    }
  }

  // ========================================
  // 2. UPDATED db.js methods (feedback-related only)
  // ========================================

  // Enhanced saveFeedback method
  async saveFeedback(feedbackData) {
    console.log("🔧 DB: Starting saveFeedback", {
      id: feedbackData.id,
      status: feedbackData.status,
      device_id: feedbackData.device_id,
    });

    try {
      const db = await this.getDB();

      if (!db.objectStoreNames.contains("feedback_local")) {
        throw new Error("feedback_local store not found");
      }

      const transaction = db.transaction(["feedback_local"], "readwrite");
      const store = transaction.objectStore("feedback_local");

      return new Promise((resolve, reject) => {
        const request = store.add(feedbackData);

        request.onsuccess = () => {
          console.log("🔧 DB: Feedback saved successfully:", feedbackData.id);
          resolve(feedbackData);
        };

        request.onerror = () => {
          console.error("🔧 DB: Save failed:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("🔧 DB: saveFeedback error:", error);
      throw error;
    }
  }

  // Get pending feedback for sync
  async getPendingFeedback() {
    console.log("🔧 DB: Getting pending feedback");

    try {
      const db = await this.getDB();
      const transaction = db.transaction(["feedback_local"], "readonly");
      const store = transaction.objectStore("feedback_local");

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const allFeedback = request.result || [];
          const pending = allFeedback.filter(
            (f) => f.status === "pending_sync"
          );

          console.log("🔧 DB: Pending feedback found:", {
            total: allFeedback.length,
            pending: pending.length,
            synced: allFeedback.filter((f) => f.status === "synced").length,
          });

          resolve(pending);
        };

        request.onerror = () => {
          console.error(
            "🔧 DB: Failed to get pending feedback:",
            request.error
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("🔧 DB: getPendingFeedback error:", error);
      throw error;
    }
  }

  // Mark feedback as synced
  async markFeedbackSynced(feedbackId) {
    console.log("🔧 DB: Marking feedback as synced:", feedbackId);

    try {
      const db = await this.getDB();
      const transaction = db.transaction(["feedback_local"], "readwrite");
      const store = transaction.objectStore("feedback_local");

      return new Promise((resolve, reject) => {
        const getRequest = store.get(feedbackId);

        getRequest.onsuccess = () => {
          const feedback = getRequest.result;
          if (feedback) {
            feedback.status = "synced";
            feedback.synced_at = new Date().toISOString();

            const putRequest = store.put(feedback);
            putRequest.onsuccess = () => {
              console.log("🔧 DB: Successfully marked as synced:", feedbackId);
              resolve(feedback);
            };
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            console.warn("🔧 DB: Feedback not found for syncing:", feedbackId);
            resolve(null);
          }
        };

        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (error) {
      console.error("🔧 DB: markFeedbackSynced error:", error);
      throw error;
    }
  }

  // ========================================
  // 3. UPDATED supabase.js method (direct to public.feedback table)
  // ========================================

  // Submit feedback directly to Supabase public.feedback table
  async submitFeedbackToSupabase(feedbackData) {
    console.log("🔧 SUPABASE: Submitting to public.feedback table");
    console.log("🔧 SUPABASE: Data being submitted:", {
      device_id: feedbackData.device_id,
      message_length: feedbackData.message?.length,
      contact_info: feedbackData.contact_info,
      anonymous: feedbackData.anonymous,
    });

    try {
      // Validate data matches your table schema
      if (!feedbackData.message || typeof feedbackData.message !== "string") {
        throw new Error("message is required and must be a string");
      }

      if (typeof feedbackData.anonymous !== "boolean") {
        feedbackData.anonymous = !feedbackData.contact_info; // default logic
      }

      console.log("🔧 SUPABASE: Calling supabase.from('feedback').insert()");

      const { data, error } = await supabase
        .from("feedback") // This matches your public.feedback table
        .insert([
          {
            device_id: feedbackData.device_id || null,
            message: feedbackData.message,
            contact_info: feedbackData.contact_info || null,
            anonymous: feedbackData.anonymous,
            // id and created_at will be auto-generated by Supabase
          },
        ])
        .select(); // Return the inserted record

      if (error) {
        console.error("🔧 SUPABASE: Insert error:", {
          code: error.code,
          message: error.message,
          details: error.details,
        });
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No data returned from Supabase insert");
      }

      console.log("🔧 SUPABASE: Successfully inserted into public.feedback:", {
        id: data[0].id,
        created_at: data[0].created_at,
        anonymous: data[0].anonymous,
      });

      return data[0]; // Return the inserted record with Supabase-generated id and created_at
    } catch (error) {
      console.error("🔧 SUPABASE: submitFeedbackToSupabase error:", error);
      throw error;
    }
  }

  // Test connection to feedback table
  async checkFeedbackConnection() {
    try {
      console.log("🔧 SUPABASE: Testing connection to feedback table");

      const { data, error } = await supabase
        .from("feedback")
        .select("id")
        .limit(1);

      if (error) {
        console.error("🔧 SUPABASE: Connection test failed:", error);
        return false;
      }

      console.log("🔧 SUPABASE: Connection test successful");
      return true;
    } catch (error) {
      console.error("🔧 SUPABASE: Connection test error:", error);
      return false;
    }
  }

  // ========================================
  // 4. DEBUGGING METHODS (add to app.js)
  // ========================================

  // Debug the feedback system
  async debugFeedbackSystem() {
    console.log("🔧 DEBUG: Starting feedback system diagnosis");

    // Test database
    try {
      const allFeedback = await dbHelper.getAllFeedback();
      console.log(
        "🔧 DEBUG: Local database working, total feedback:",
        allFeedback.length
      );
    } catch (error) {
      console.error("🔧 DEBUG: Local database error:", error);
    }

    // Test Supabase
    try {
      const connected = await supabaseHelper.checkFeedbackConnection();
      console.log("🔧 DEBUG: Supabase connection:", connected);
    } catch (error) {
      console.error("🔧 DEBUG: Supabase connection error:", error);
    }

    // Check device ID
    const deviceId = dbHelper.getDeviceId();
    console.log("🔧 DEBUG: Device ID:", deviceId);

    // Test form elements
    const form = document.getElementById("feedback-form");
    const messageInput = document.getElementById("feedback-message");
    const contactInput = document.getElementById("feedback-contact");

    console.log("🔧 DEBUG: Form elements:", {
      form: !!form,
      messageInput: !!messageInput,
      contactInput: !!contactInput,
    });
  }

  // Enhanced saveFeedbackLocally method with more debugging
  async saveFeedbackLocally(feedbackData) {
    console.log("🔧 FEEDBACK LOCAL: Starting local save");
    console.log("🔧 FEEDBACK LOCAL: Input data:", {
      device_id: feedbackData.device_id,
      message_length: feedbackData.message?.length,
      contact_info: feedbackData.contact_info,
      anonymous: feedbackData.anonymous,
    });

    try {
      const feedbackWithTimestamp = {
        ...feedbackData,
        submitted_at: new Date().toISOString(),
        status: "pending_sync",
        id:
          "feedback_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substr(2, 9),
      };

      console.log("🔧 FEEDBACK LOCAL: Generated feedback object", {
        id: feedbackWithTimestamp.id,
        submitted_at: feedbackWithTimestamp.submitted_at,
        status: feedbackWithTimestamp.status,
        device_id: feedbackWithTimestamp.device_id,
        message_length: feedbackWithTimestamp.message.length,
      });

      // Check if dbHelper is available
      if (!dbHelper) {
        throw new Error("dbHelper is not available");
      }

      console.log("🔧 FEEDBACK LOCAL: Calling dbHelper.saveFeedback");
      const result = await dbHelper.saveFeedback(feedbackWithTimestamp);
      console.log(
        "🔧 FEEDBACK LOCAL: dbHelper.saveFeedback returned:",
        result?.id
      );

      return result;
    } catch (error) {
      console.error("🔧 FEEDBACK LOCAL: Local save failed:", error);
      console.error("🔧 FEEDBACK LOCAL: Error stack:", error.stack);
      throw new Error(`Unable to save feedback locally: ${error.message}`);
    }
  }

  // New background sync method (non-blocking)
  async attemptBackgroundFeedbackSync(feedbackItem) {
    console.log(
      "🔧 FEEDBACK BACKGROUND: Starting background sync for:",
      feedbackItem.id
    );

    try {
      // Check network status first
      console.log("🔧 FEEDBACK BACKGROUND: Network status:", {
        online: navigator.onLine,
        isOnline: this.isOnline,
      });

      if (!navigator.onLine) {
        console.log("🔧 FEEDBACK BACKGROUND: Offline, skipping sync");
        return false;
      }

      const syncData = {
        device_id: feedbackItem.device_id,
        message: feedbackItem.message,
        contact_info: feedbackItem.contact_info,
        anonymous: feedbackItem.anonymous,
      };

      console.log("🔧 FEEDBACK BACKGROUND: Attempting Supabase submission");
      await supabaseHelper.submitFeedback(syncData);
      console.log(
        "🔧 FEEDBACK BACKGROUND: Supabase success, marking as synced"
      );

      // Mark as synced in local DB
      await dbHelper.markFeedbackSynced(feedbackItem.id);
      console.log(
        "🔧 FEEDBACK BACKGROUND: Background sync complete for:",
        feedbackItem.id
      );

      return true;
    } catch (error) {
      console.warn(
        "🔧 FEEDBACK BACKGROUND: Background sync failed (will retry later):",
        error.message
      );
      return false;
    }
  }

  // Enhanced syncOfflineData method (background sync for all pending)
  async syncOfflineData() {
    console.log("🔧 SYNC: Starting comprehensive offline data sync");

    if (!navigator.onLine) {
      console.log("🔧 SYNC: Offline, skipping sync");
      return;
    }

    // Sync ideas queue (existing code)
    console.log("🔧 SYNC: Syncing ideas queue");
    const queue = await dbHelper.getSyncQueue();
    let ideasSynced = 0;

    for (const item of queue) {
      try {
        await supabaseHelper.submitFinalIdea(item);
        await supabaseHelper.createUser(item.full_name);
        await dbHelper.removeFromSyncQueue(item.key);
        ideasSynced++;
      } catch (error) {
        console.error("🔧 SYNC: Failed to sync idea:", item.key, error);
      }
    }
    console.log("🔧 SYNC: Ideas sync complete, synced:", ideasSynced);

    // Enhanced feedback sync with detailed debugging
    console.log("🔧 SYNC: Starting feedback sync");
    try {
      const pendingFeedback = await dbHelper.getPendingFeedback();
      console.log("🔧 SYNC: Found pending feedback items:", {
        count: pendingFeedback.length,
        items: pendingFeedback.map((f) => ({
          id: f.id,
          submitted_at: f.submitted_at,
        })),
      });

      let feedbackSynced = 0;
      let feedbackFailed = 0;

      for (const feedback of pendingFeedback) {
        console.log("🔧 SYNC: Processing feedback:", feedback.id);

        try {
          const syncData = {
            device_id: feedback.device_id,
            message: feedback.message,
            contact_info: feedback.contact_info,
            anonymous: feedback.anonymous,
          };

          console.log("🔧 SYNC: Submitting to Supabase:", feedback.id);
          await supabaseHelper.submitFeedback(syncData);
          console.log(
            "🔧 SYNC: Supabase success, marking synced:",
            feedback.id
          );

          await dbHelper.markFeedbackSynced(feedback.id);
          console.log("🔧 SYNC: Marked as synced in local DB:", feedback.id);

          feedbackSynced++;
        } catch (error) {
          console.error(
            "🔧 SYNC: Failed to sync feedback:",
            feedback.id,
            error
          );
          feedbackFailed++;
        }
      }

      console.log("🔧 SYNC: Feedback sync summary:", {
        synced: feedbackSynced,
        failed: feedbackFailed,
        total: pendingFeedback.length,
      });
    } catch (error) {
      console.error("🔧 SYNC: Error during feedback sync process:", error);
    }

    // Show consolidated success message
    const totalSynced = ideasSynced + (feedbackSynced || 0);
    if (totalSynced > 0) {
      console.log("🔧 SYNC: Total items synced:", totalSynced);
      this.showMessage(`Synced ${totalSynced} items in background`, "success");
    }
  }

  // ========================================
  // 2. UPDATED db.js methods with extensive debugging
  // ========================================

  // Enhanced saveFeedback method in dbHelper object
  async saveFeedback(feedbackData) {
    console.log("🔧 DB SAVE: Starting saveFeedback");
    console.log("🔧 DB SAVE: Input data:", {
      id: feedbackData.id,
      device_id: feedbackData.device_id,
      status: feedbackData.status,
      message_length: feedbackData.message?.length,
      submitted_at: feedbackData.submitted_at,
    });

    try {
      console.log("🔧 DB SAVE: Getting database connection");
      const db = await this.getDB();

      if (!db) {
        throw new Error("Failed to get database connection");
      }

      console.log("🔧 DB SAVE: Database connection successful");
      console.log(
        "🔧 DB SAVE: Available object stores:",
        Array.from(db.objectStoreNames)
      );

      if (!db.objectStoreNames.contains("feedback_local")) {
        throw new Error("feedback_local object store not found in database");
      }

      console.log("🔧 DB SAVE: Creating transaction");
      const transaction = db.transaction(["feedback_local"], "readwrite");
      const store = transaction.objectStore("feedback_local");

      return new Promise((resolve, reject) => {
        console.log("🔧 DB SAVE: Adding data to store");
        const request = store.add(feedbackData);

        request.onsuccess = () => {
          console.log(
            "🔧 DB SAVE: SUCCESS - Feedback saved with ID:",
            feedbackData.id
          );
          resolve(feedbackData);
        };

        request.onerror = (event) => {
          console.error("🔧 DB SAVE: ERROR - Failed to save feedback:", {
            id: feedbackData.id,
            error: request.error,
            event: event,
          });
          reject(request.error);
        };

        transaction.onerror = (event) => {
          console.error("🔧 DB SAVE: TRANSACTION ERROR:", event);
          reject(new Error("Transaction failed"));
        };

        transaction.onabort = (event) => {
          console.error("🔧 DB SAVE: TRANSACTION ABORTED:", event);
          reject(new Error("Transaction aborted"));
        };
      });
    } catch (error) {
      console.error("🔧 DB SAVE: CATCH ERROR:", error);
      console.error("🔧 DB SAVE: Error stack:", error.stack);
      throw error;
    }
  }

  // Enhanced getPendingFeedback method
  async getPendingFeedback() {
    console.log("🔧 DB GET: Getting pending feedback");

    try {
      const db = await this.getDB();
      console.log("🔧 DB GET: Database connection successful");

      const transaction = db.transaction(["feedback_local"], "readonly");
      const store = transaction.objectStore("feedback_local");

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const allFeedback = request.result || [];
          const pending = allFeedback.filter(
            (f) => f.status === "pending_sync"
          );

          console.log("🔧 DB GET: Feedback summary:", {
            total_in_db: allFeedback.length,
            pending_sync: pending.length,
            synced: allFeedback.filter((f) => f.status === "synced").length,
            pending_ids: pending.map((f) => f.id),
            all_statuses: allFeedback.map((f) => ({
              id: f.id,
              status: f.status,
            })),
          });

          resolve(pending);
        };

        request.onerror = () => {
          console.error(
            "🔧 DB GET: Failed to get pending feedback:",
            request.error
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("🔧 DB GET: Error getting pending feedback:", error);
      throw error;
    }
  }

  // Enhanced markFeedbackSynced method
  async markFeedbackSynced(feedbackId) {
    console.log("🔧 DB SYNC: Marking feedback as synced:", feedbackId);

    try {
      const db = await this.getDB();
      const transaction = db.transaction(["feedback_local"], "readwrite");
      const store = transaction.objectStore("feedback_local");

      return new Promise((resolve, reject) => {
        const getRequest = store.get(feedbackId);

        getRequest.onsuccess = () => {
          const feedback = getRequest.result;
          console.log("🔧 DB SYNC: Retrieved feedback for syncing:", {
            id: feedbackId,
            found: !!feedback,
            current_status: feedback?.status,
          });

          if (feedback) {
            feedback.status = "synced";
            feedback.synced_at = new Date().toISOString();

            const putRequest = store.put(feedback);

            putRequest.onsuccess = () => {
              console.log("🔧 DB SYNC: SUCCESS - Marked as synced:", {
                id: feedbackId,
                synced_at: feedback.synced_at,
              });
              resolve(feedback);
            };

            putRequest.onerror = () => {
              console.error("🔧 DB SYNC: Failed to update status:", {
                id: feedbackId,
                error: putRequest.error,
              });
              reject(putRequest.error);
            };
          } else {
            console.warn("🔧 DB SYNC: Feedback not found:", feedbackId);
            resolve(null);
          }
        };

        getRequest.onerror = () => {
          console.error("🔧 DB SYNC: Failed to get feedback:", {
            id: feedbackId,
            error: getRequest.error,
          });
          reject(getRequest.error);
        };
      });
    } catch (error) {
      console.error("🔧 DB SYNC: Error in markFeedbackSynced:", error);
      throw error;
    }
  }

  // New debug method to inspect feedback table
  async debugFeedbackTable() {
    console.log("🔧 DB DEBUG: Inspecting feedback table");

    try {
      const db = await this.getDB();
      const transaction = db.transaction(["feedback_local"], "readonly");
      const store = transaction.objectStore("feedback_local");

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const allFeedback = request.result || [];
          console.log("🔧 DB DEBUG: Complete feedback table contents:", {
            total_count: allFeedback.length,
            items: allFeedback.map((f) => ({
              id: f.id,
              status: f.status,
              submitted_at: f.submitted_at,
              synced_at: f.synced_at,
              message_preview: f.message?.substring(0, 50),
            })),
          });
          resolve(allFeedback);
        };

        request.onerror = () => {
          console.error("🔧 DB DEBUG: Failed to inspect table:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("🔧 DB DEBUG: Error inspecting feedback table:", error);
      throw error;
    }
  }

  // ========================================
  // 3. UPDATED supabase.js submitFeedback method with more debugging
  // ========================================

  async submitFeedback(feedback) {
    console.log("🔧 SUPABASE SUBMIT: Starting feedback submission");
    console.log("🔧 SUPABASE SUBMIT: Input data:", {
      device_id: feedback.device_id,
      message_length: feedback.message?.length,
      has_contact: !!feedback.contact_info,
      anonymous: feedback.anonymous,
    });

    try {
      // Enhanced input validation
      if (!feedback) {
        throw new Error("No feedback data provided");
      }

      if (!feedback.message || typeof feedback.message !== "string") {
        console.error(
          "🔧 SUPABASE SUBMIT: Invalid message:",
          typeof feedback.message,
          feedback.message
        );
        throw new Error("Invalid feedback message");
      }

      if (!feedback.device_id) {
        console.error("🔧 SUPABASE SUBMIT: Missing device_id");
        throw new Error("Device ID is required");
      }

      // Prepare data for submission
      const submissionData = {
        device_id: feedback.device_id,
        message: feedback.message.trim(),
        contact_info: feedback.contact_info?.trim() || null,
        anonymous: !feedback.contact_info?.trim(),
      };

      console.log("🔧 SUPABASE SUBMIT: Prepared submission data:", {
        device_id: submissionData.device_id,
        message_length: submissionData.message.length,
        has_contact: !!submissionData.contact_info,
        anonymous: submissionData.anonymous,
        message_preview: submissionData.message.substring(0, 100),
      });

      // Check if supabase client is available
      if (!supabase) {
        throw new Error("Supabase client not available");
      }

      console.log(
        "🔧 SUPABASE SUBMIT: Calling supabase.from('feedback').insert()"
      );
      const { data, error } = await supabase
        .from("feedback")
        .insert([submissionData])
        .select();

      console.log("🔧 SUPABASE SUBMIT: Supabase response:", {
        data: data,
        error: error,
        has_data: !!data,
        data_length: data?.length,
        error_message: error?.message,
        error_code: error?.code,
      });

      if (error) {
        console.error("🔧 SUPABASE SUBMIT: Database error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        // Provide more specific error messages
        if (error.code === "23505") {
          throw new Error("Duplicate feedback submission detected");
        } else if (error.code === "23514") {
          throw new Error("Feedback data validation failed");
        } else if (error.message?.includes("permission")) {
          throw new Error("Permission denied - unable to submit feedback");
        } else if (error.message?.includes("network")) {
          throw new Error("Network error - check your connection");
        } else {
          throw new Error(
            `Database error: ${error.message || "Unknown error"}`
          );
        }
      }

      if (!data || data.length === 0) {
        console.warn("🔧 SUPABASE SUBMIT: No data returned from insert");
        throw new Error("Feedback submission failed - no response from server");
      }

      console.log("🔧 SUPABASE SUBMIT: SUCCESS - Feedback submitted:", {
        id: data[0].id,
        created_at: data[0].created_at,
        device_id: data[0].device_id,
      });

      return data[0];
    } catch (error) {
      console.error("🔧 SUPABASE SUBMIT: Complete error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
      });

      // Re-throw with enhanced error information
      if (error.message?.includes("fetch")) {
        throw new Error("Network connection failed");
      } else if (error.message?.includes("JSON")) {
        throw new Error("Server response format error");
      } else {
        // Pass through our custom error messages or wrap unknown errors
        throw error.message
          ? error
          : new Error(`Feedback submission failed: ${error}`);
      }
    }
  }

  // ========================================
  // 4. DEBUGGING HELPER METHODS (add to app.js)
  // ========================================

  // Add this method to your CapseraApp class for debugging
  async debugFeedbackSystem() {
    console.log(
      "🔧 DEBUG SYSTEM: Starting comprehensive feedback system debug"
    );

    // Check database
    try {
      console.log("🔧 DEBUG SYSTEM: Testing database connection");
      const allFeedback = await dbHelper.debugFeedbackTable();
      console.log(
        "🔧 DEBUG SYSTEM: Database working, items:",
        allFeedback.length
      );
    } catch (error) {
      console.error("🔧 DEBUG SYSTEM: Database error:", error);
    }

    // Check Supabase connection
    try {
      console.log("🔧 DEBUG SYSTEM: Testing Supabase connection");
      const connected = await supabaseHelper.checkFeedbackConnection();
      console.log("🔧 DEBUG SYSTEM: Supabase connection:", connected);
    } catch (error) {
      console.error("🔧 DEBUG SYSTEM: Supabase connection error:", error);
    }

    // Check device ID
    try {
      const deviceId = dbHelper.getDeviceId();
      console.log("🔧 DEBUG SYSTEM: Device ID:", deviceId);
    } catch (error) {
      console.error("🔧 DEBUG SYSTEM: Device ID error:", error);
    }
  }

  // Call this method in browser console: app.debugFeedbackSystem()

  // Enhanced saveFeedbackLocally method
  async saveFeedbackLocally(feedbackData) {
    try {
      const feedbackWithTimestamp = {
        ...feedbackData,
        submitted_at: new Date().toISOString(),
        status: "pending_sync",
        id:
          "feedback_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substr(2, 9),
      };

      console.log("🔧 FEEDBACK: Attempting local save with data:", {
        id: feedbackWithTimestamp.id,
        device_id: feedbackWithTimestamp.device_id,
        message_length: feedbackWithTimestamp.message.length,
        status: feedbackWithTimestamp.status,
      });

      const result = await dbHelper.saveFeedback(feedbackWithTimestamp);
      console.log("🔧 FEEDBACK: Local save successful for ID:", result.id);

      return result;
    } catch (error) {
      console.error("🔧 FEEDBACK: Local save failed:", error);
      throw new Error(`Unable to save feedback locally: ${error.message}`);
    }
  }

  // New method to sync a single feedback item
  async syncSingleFeedback(feedbackItem) {
    try {
      console.log(
        "🔧 FEEDBACK SYNC: Attempting to sync feedback ID:",
        feedbackItem.id
      );

      const syncData = {
        device_id: feedbackItem.device_id,
        message: feedbackItem.message,
        contact_info: feedbackItem.contact_info,
        anonymous: feedbackItem.anonymous,
      };

      await supabaseHelper.submitFeedback(syncData);
      console.log(
        "🔧 FEEDBACK SYNC: Supabase submission successful for ID:",
        feedbackItem.id
      );

      // Mark as synced in local DB
      await dbHelper.markFeedbackSynced(feedbackItem.id);
      console.log(
        "🔧 FEEDBACK SYNC: Marked as synced in local DB:",
        feedbackItem.id
      );

      return true;
    } catch (error) {
      console.error(
        "🔧 FEEDBACK SYNC: Failed to sync feedback ID:",
        feedbackItem.id,
        error
      );
      return false;
    }
  }

  // Enhanced syncOfflineData method (feedback portion only)
  async syncOfflineData() {
    if (!this.isOnline) return;

    console.log("🔧 SYNC: Starting offline data sync");

    // Sync ideas queue (existing code stays the same)
    const queue = await dbHelper.getSyncQueue();
    let ideasSynced = 0;

    for (const item of queue) {
      try {
        await supabaseHelper.submitFinalIdea(item);
        await supabaseHelper.createUser(item.full_name);
        await dbHelper.removeFromSyncQueue(item.key);
        ideasSynced++;
      } catch (error) {
        console.error("🔧 SYNC: Failed to sync idea:", item.key, error);
      }
    }

    // Enhanced feedback sync
    try {
      const pendingFeedback = await dbHelper.getPendingFeedback();
      console.log(
        "🔧 FEEDBACK SYNC: Found pending feedback items:",
        pendingFeedback.length
      );

      let feedbackSynced = 0;
      let feedbackFailed = 0;

      for (const feedback of pendingFeedback) {
        try {
          console.log("🔧 FEEDBACK SYNC: Processing feedback ID:", feedback.id);

          const syncData = {
            device_id: feedback.device_id,
            message: feedback.message,
            contact_info: feedback.contact_info,
            anonymous: feedback.anonymous,
          };

          await supabaseHelper.submitFeedback(syncData);
          console.log(
            "🔧 FEEDBACK SYNC: Supabase success for ID:",
            feedback.id
          );

          await dbHelper.markFeedbackSynced(feedback.id);
          console.log(
            "🔧 FEEDBACK SYNC: Marked synced in local DB:",
            feedback.id
          );

          feedbackSynced++;
        } catch (error) {
          console.error(
            "🔧 FEEDBACK SYNC: Failed to sync feedback ID:",
            feedback.id,
            error
          );
          feedbackFailed++;
        }
      }

      if (feedbackSynced > 0) {
        console.log(
          `🔧 FEEDBACK SYNC: Successfully synced ${feedbackSynced} feedback submissions`
        );
      }

      if (feedbackFailed > 0) {
        console.log(
          `🔧 FEEDBACK SYNC: Failed to sync ${feedbackFailed} feedback submissions - will retry later`
        );
      }
    } catch (error) {
      console.error(
        "🔧 FEEDBACK SYNC: Error during feedback sync process:",
        error
      );
    }

    // Show success message for total synced items
    const totalSynced = ideasSynced + (feedbackSynced || 0);
    if (totalSynced > 0) {
      this.showMessage(
        `Synced ${totalSynced} items (${ideasSynced} ideas, ${
          feedbackSynced || 0
        } feedback)`,
        "success"
      );
    }
  }

  // ========================================
  // 2. UPDATED db.js methods (feedback-related only)
  // ========================================

  // Enhanced saveFeedback method in dbHelper object
  async saveFeedback(feedbackData) {
    console.log("🔧 DB: Starting saveFeedback with data:", {
      id: feedbackData.id,
      device_id: feedbackData.device_id,
      status: feedbackData.status,
      message_length: feedbackData.message?.length,
    });

    const db = await this.getDB();
    const transaction = db.transaction(["feedback_local"], "readwrite");
    const store = transaction.objectStore("feedback_local");

    return new Promise((resolve, reject) => {
      const request = store.add(feedbackData);

      request.onsuccess = () => {
        console.log("🔧 DB: saveFeedback successful for ID:", feedbackData.id);
        resolve(feedbackData);
      };

      request.onerror = () => {
        console.error(
          "🔧 DB: saveFeedback failed for ID:",
          feedbackData.id,
          request.error
        );
        reject(request.error);
      };
    });
  }

  // Enhanced getPendingFeedback method
  async getPendingFeedback() {
    console.log("🔧 DB: Getting pending feedback");

    const db = await this.getDB();
    const transaction = db.transaction(["feedback_local"], "readonly");
    const store = transaction.objectStore("feedback_local");

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const allFeedback = request.result || [];
        const pending = allFeedback.filter((f) => f.status === "pending_sync");

        console.log("🔧 DB: Found pending feedback:", {
          total: allFeedback.length,
          pending: pending.length,
          pending_ids: pending.map((f) => f.id),
        });

        resolve(pending);
      };

      request.onerror = () => {
        console.error("🔧 DB: getPendingFeedback failed:", request.error);
        reject(request.error);
      };
    });
  }

  // Enhanced markFeedbackSynced method
  async markFeedbackSynced(feedbackId) {
    console.log("🔧 DB: Marking feedback as synced:", feedbackId);

    const db = await this.getDB();
    const transaction = db.transaction(["feedback_local"], "readwrite");
    const store = transaction.objectStore("feedback_local");

    return new Promise((resolve, reject) => {
      const getRequest = store.get(feedbackId);

      getRequest.onsuccess = () => {
        const feedback = getRequest.result;
        if (feedback) {
          feedback.status = "synced";
          feedback.synced_at = new Date().toISOString();

          const putRequest = store.put(feedback);

          putRequest.onsuccess = () => {
            console.log(
              "🔧 DB: Successfully marked feedback as synced:",
              feedbackId
            );
            resolve(feedback);
          };

          putRequest.onerror = () => {
            console.error(
              "🔧 DB: Failed to update feedback status:",
              feedbackId,
              putRequest.error
            );
            reject(putRequest.error);
          };
        } else {
          console.warn("🔧 DB: Feedback not found for syncing:", feedbackId);
          resolve(null);
        }
      };

      getRequest.onerror = () => {
        console.error(
          "🔧 DB: Failed to get feedback for syncing:",
          feedbackId,
          getRequest.error
        );
        reject(getRequest.error);
      };
    });
  }

  // ========================================
  // 3. UPDATED supabase.js submitFeedback method
  // ========================================

  async submitFeedback(feedback) {
    console.log("🔧 SUPABASE: Starting feedback submission", {
      device_id: feedback.device_id,
      message_length: feedback.message?.length,
      has_contact: !!feedback.contact_info,
      anonymous: feedback.anonymous,
    });

    try {
      // Validate input data
      if (!feedback.message || typeof feedback.message !== "string") {
        throw new Error("Invalid feedback message");
      }

      if (!feedback.device_id) {
        throw new Error("Device ID is required");
      }

      // Prepare data for submission
      const submissionData = {
        device_id: feedback.device_id,
        message: feedback.message.trim(),
        contact_info: feedback.contact_info?.trim() || null,
        anonymous: !feedback.contact_info?.trim(),
      };

      console.log("🔧 SUPABASE: Submitting to database", {
        device_id: submissionData.device_id,
        message_length: submissionData.message.length,
        has_contact: !!submissionData.contact_info,
        anonymous: submissionData.anonymous,
      });

      const { data, error } = await supabase
        .from("feedback")
        .insert([submissionData])
        .select();

      if (error) {
        console.error("🔧 SUPABASE: Database error:", error);

        // Provide more specific error messages
        if (error.code === "23505") {
          throw new Error("Duplicate feedback submission detected");
        } else if (error.code === "23514") {
          throw new Error("Feedback data validation failed");
        } else if (error.message?.includes("permission")) {
          throw new Error("Permission denied - unable to submit feedback");
        } else if (error.message?.includes("network")) {
          throw new Error("Network error - check your connection");
        } else {
          throw new Error(
            `Database error: ${error.message || "Unknown error"}`
          );
        }
      }

      if (!data || data.length === 0) {
        console.warn("🔧 SUPABASE: No data returned from insert");
        throw new Error("Feedback submission failed - no response from server");
      }

      console.log("🔧 SUPABASE: Feedback submission successful", {
        id: data[0].id,
        created_at: data[0].created_at,
      });

      return data[0];
    } catch (error) {
      console.error("🔧 SUPABASE: submitFeedback error:", error);

      // Re-throw with enhanced error information
      if (error.message?.includes("fetch")) {
        throw new Error("Network connection failed");
      } else if (error.message?.includes("JSON")) {
        throw new Error("Server response format error");
      } else {
        // Pass through our custom error messages or wrap unknown errors
        throw error.message
          ? error
          : new Error(`Feedback submission failed: ${error}`);
      }
    }
  }

  // New method to save feedback locally as per instructions
  async saveFeedbackLocally(feedbackData) {
    try {
      const feedbackWithTimestamp = {
        ...feedbackData,
        submitted_at: new Date().toISOString(),
        status: "pending_sync",
        id:
          "feedback_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substr(2, 9),
      };

      console.log(
        "🔧 FEEDBACK DEBUG: Saving locally",
        feedbackWithTimestamp.id
      );

      await dbHelper.saveFeedback(feedbackWithTimestamp);

      console.log("🔧 FEEDBACK DEBUG: Local save successful");
      return feedbackWithTimestamp;
    } catch (error) {
      console.error("🔧 FEEDBACK DEBUG: Local save failed:", error);
      throw new Error(`Unable to save feedback locally: ${error.message}`);
    }
  }

  async viewIdeaDetails(ideaId) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Idea Details</h3>
          <button onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="loading">Loading details...</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    try {
      const result = await supabaseHelper.getIdeaDetails(ideaId);

      const modalBody = modal.querySelector(".modal-body");

      if (result.restricted) {
        modalBody.innerHTML = `
          <div class="text-center">
            <p>${
              result.message || "Detailed view is not available at this time."
            }</p>
          </div>
        `;
      } else {
        const idea = result.data;
        modalBody.innerHTML = `
          <div class="idea-details">
            <h4>Customer Profile</h4>
            <p>${this.escapeHtml(idea.ideal_customer_profile)}</p>
            
            <h4>Product Idea</h4>
            <p>${this.escapeHtml(idea.product_idea)}</p>
            
            <h4>Pain Points</h4>
            <p>${this.escapeHtml(idea.pain_points)}</p>
            
            <h4>Alternatives</h4>
            <p>${this.escapeHtml(idea.alternatives)}</p>
            
            <div class="idea-meta">
              Categories: ${
                Array.isArray(idea.category)
                  ? idea.category.join(", ")
                  : idea.category || "None"
              } • 
              Quality Score: ${idea.quality_score}/100
            </div>
            
            ${this.renderAIFeedback(idea.ai_feedback)}
          </div>
        `;
      }
    } catch (error) {
      modal.querySelector(".modal-body").innerHTML =
        '<div class="error">Failed to load idea details</div>';
    }
  }

  // Screen 2: My Submissions - Fixed duplicates and improved project display
  async loadSubmissionsScreen() {
    const container = document.getElementById("submissions-list");
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading submissions...</div>';

    const drafts = await dbHelper.getAllDrafts();

    if (drafts.length === 0) {
      container.innerHTML = '<div class="text-center">No submissions yet</div>';
      return;
    }

    // Deduplicate by creating unique key per submission
    const uniqueDrafts = {};
    drafts.forEach((draft) => {
      const key = `${draft.full_name}-${draft.project_name || "Default"}-v${
        draft.version
      }`;
      if (!uniqueDrafts[key] || draft.saved_at > uniqueDrafts[key].saved_at) {
        uniqueDrafts[key] = draft;
      }
    });

    const dedupedDrafts = Object.values(uniqueDrafts);

    // Group by user, then by project
    const userGroups = {};
    dedupedDrafts.forEach((draft) => {
      if (!userGroups[draft.full_name]) {
        userGroups[draft.full_name] = {};
      }
      const projectKey = draft.project_name || "Default Project";
      if (!userGroups[draft.full_name][projectKey]) {
        userGroups[draft.full_name][projectKey] = [];
      }
      userGroups[draft.full_name][projectKey].push(draft);
    });

    let html = "";
    Object.entries(userGroups).forEach(([userName, userProjects]) => {
      html += `
        <div class="user-section">
          <div class="user-header">${this.escapeHtml(userName)}</div>
          <div class="projects-overview">
            <h4>Projects Summary</h4>
            ${Object.entries(userProjects)
              .map(([projectName, projectDrafts]) => {
                const finalDraft = projectDrafts.find((d) => d.is_final);
                const maxVersion = Math.max(
                  ...projectDrafts.map((d) => d.version)
                );
                const status = finalDraft
                  ? "Final Submitted"
                  : `Draft v${maxVersion}/3`;
                const statusClass = finalDraft ? "success" : "warning";

                return `
                <div class="project-overview">
                  <div class="project-header">
                    <strong>${this.escapeHtml(projectName)}</strong>
                    <span class="status ${statusClass}">${status}</span>
                  </div>
                  <div class="project-meta">
                    ${projectDrafts.length} attempt${
                  projectDrafts.length !== 1 ? "s" : ""
                } • 
                    Last updated: ${new Date(
                      Math.max(
                        ...projectDrafts.map((d) => new Date(d.saved_at))
                      )
                    ).toLocaleDateString()}
                  </div>
                  <div class="project-preview">
                    ${this.escapeHtml(
                      (
                        projectDrafts.sort((a, b) => b.version - a.version)[0]
                          .product_idea || ""
                      ).substring(0, 100)
                    )}${
                  projectDrafts[0].product_idea &&
                  projectDrafts[0].product_idea.length > 100
                    ? "..."
                    : ""
                }
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
          <div class="user-submissions">
            <h4>All Submissions</h4>
            ${Object.entries(userProjects)
              .map(([projectName, projectDrafts]) =>
                projectDrafts
                  .sort((a, b) => b.version - a.version)
                  .map((draft) => this.renderSubmissionItem(draft, projectName))
                  .join("")
              )
              .join("")}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  renderSubmissionItem(draft, projectName) {
    const statusText = draft.is_final
      ? "Final Submission"
      : `Draft v${draft.version}`;
    const statusClass = draft.is_final ? "success" : "warning";

    // Handle both old and new AI feedback formats for display
    const aiScore =
      draft.ai_feedback?.overall_score || draft.ai_feedback?.score;

    return `
      <div class="submission-item">
        <div class="submission-header">
          <strong>${this.escapeHtml(projectName)} - ${this.escapeHtml(
      (draft.product_idea || "").substring(0, 60)
    )}${
      draft.product_idea && draft.product_idea.length > 60 ? "..." : ""
    }</strong>
          <span class="status ${statusClass}">${statusText}</span>
        </div>
        <div class="submission-meta">
          Saved: ${new Date(draft.saved_at).toLocaleString()}
          ${aiScore ? `• AI Score: ${aiScore}/100` : ""}
        </div>
        ${this.renderAIFeedback(draft.ai_feedback)}
      </div>
    `;
  }

  renderAIFeedback(feedback) {
    if (!feedback) return "";

    // Handle both old and new feedback formats
    if (feedback.critique && feedback.suggestions && feedback.grading) {
      // New structured format
      return this.renderStructuredAIFeedback(feedback);
    } else {
      // Legacy format
      return this.renderLegacyAIFeedback(feedback);
    }
  }

  renderStructuredAIFeedback(feedback) {
    return `
      <div class="ai-feedback">
        <h5>AI Analysis (Score: ${feedback.overall_score}/100)</h5>
        
        <div class="feedback-summary">
          <p><strong>Summary:</strong> ${this.escapeHtml(feedback.summary)}</p>
        </div>
        
        <div class="critique-section">
          <h6>Strengths</h6>
          <ul>${feedback.critique.strengths
            .map((strength) => `<li>${this.escapeHtml(strength)}</li>`)
            .join("")}</ul>
          
          <h6>Areas for Improvement</h6>
          <ul>${feedback.critique.weaknesses
            .map((weakness) => `<li>${this.escapeHtml(weakness)}</li>`)
            .join("")}</ul>
        </div>
        
        <div class="suggestions-section">
          <h6>Actionable Recommendations</h6>
          <ul>${feedback.suggestions
            .map((suggestion) => `<li>${this.escapeHtml(suggestion)}</li>`)
            .join("")}</ul>
        </div>
        
        <div class="grading-section">
          <h6>Detailed Scoring</h6>
          <div class="score-grid">
            ${Object.entries(feedback.grading)
              .map(
                ([criterion, data]) => `
                <div class="score-item">
                  <div class="score-label">${this.formatFeedbackTitle(
                    criterion
                  )}</div>
                  <div class="score-value">${data.score}/10</div>
                  <div class="score-reasoning">${this.escapeHtml(
                    data.reasoning
                  )}</div>
                </div>
              `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  renderLegacyAIFeedback(feedback) {
    return `
      <div class="ai-feedback">
        <h5>AI Feedback (Score: ${feedback.score}/100)</h5>
        <div class="feedback-sections">
          ${Object.entries(feedback)
            .filter(([key]) => key !== "score")
            .map(
              ([key, bullets]) => `
            <div class="feedback-section">
              <h6>${this.formatFeedbackTitle(key)}</h6>
              <ul>${bullets
                .map((bullet) => `<li>${this.escapeHtml(bullet)}</li>`)
                .join("")}</ul>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  // Screen 3: Submit Ideas - Fixed to allow 3 attempts and final draft confirmation
  loadSubmitScreen() {
    this.setupSubmitForm();
    this.updateWordCounts();
    this.setupUserSelectOptions();
    this.setupCategoryMultiSelect();
  }

  setupSubmitForm() {
    const form = document.getElementById("submit-form");
    if (!form) return;

    // Remove existing listeners to avoid duplicates
    form.removeEventListener("submit", this.handleSubmissionBound);

    // Bind the method to preserve 'this' context
    this.handleSubmissionBound = this.handleSubmission.bind(this);

    // Form submission
    form.addEventListener("submit", this.handleSubmissionBound);

    // Word count listeners
    form.querySelectorAll('textarea, input[type="text"]').forEach((input) => {
      input.removeEventListener("input", this.updateWordCountsBound);
      this.updateWordCountsBound = this.updateWordCounts.bind(this);
      input.addEventListener("input", this.updateWordCountsBound);
    });

    // User selection
    const userSelect = document.getElementById("user-select");
    if (userSelect) {
      userSelect.removeEventListener("change", this.handleUserSelectBound);
      this.handleUserSelectBound = this.handleUserSelect.bind(this);
      userSelect.addEventListener("change", this.handleUserSelectBound);
    }

    // Project selection
    const projectSelect = document.getElementById("project-select");
    if (projectSelect) {
      projectSelect.removeEventListener(
        "change",
        this.handleProjectSelectBound
      );
      this.handleProjectSelectBound = this.handleProjectSelect.bind(this);
      projectSelect.addEventListener("change", this.handleProjectSelectBound);
    }
  }

  setupCategoryMultiSelect() {
    const categorySelect = document.getElementById("category");
    if (!categorySelect) return;

    // Convert single select to multi-select
    categorySelect.multiple = true;
    categorySelect.size = 5; // Show 5 options at once
  }

  handleUserSelect(e) {
    if (e.target.value === "new") {
      this.showUserCreationForm();
    } else if (e.target.value) {
      this.selectExistingUser(e.target.value);
    }
  }

  handleProjectSelect(e) {
    if (e.target.value === "new") {
      this.createNewProject();
    } else {
      this.currentProject = e.target.value;
    }
  }

  async createNewProject() {
    const projectName = prompt("Enter project name:");
    if (!projectName) return;

    this.currentProject = projectName;

    // Save a placeholder draft locally to persist the project
    await dbHelper.saveDraft({
      device_id: dbHelper.getDeviceId(),
      full_name: this.currentUser,
      project_name: projectName,
      ideal_customer_profile: "",
      product_idea: "",
      pain_points: "",
      alternatives: "",
      category: [],
      heard_about: "",
      version: 0, // 0 means placeholder
      is_final: false,
    });

    await this.setupProjectSelectOptions();
    this.showMessage(`Project "${projectName}" created`, "success");
  }

  async setupProjectSelectOptions() {
    const projectSelect = document.getElementById("project-select");
    if (!projectSelect || !this.currentUser) return;

    const userDrafts = await dbHelper.getDraftsByUser(this.currentUser);
    const projects = [
      ...new Set(userDrafts.map((d) => d.project_name || "Default Project")),
    ];

    projectSelect.innerHTML = `
      <option value="">Select Project</option>
      <option value="new">Create New Project</option>
      ${projects
        .map(
          (project) =>
            `<option value="${this.escapeHtml(project)}" ${
              project === this.currentProject ? "selected" : ""
            }>${this.escapeHtml(project)}</option>`
        )
        .join("")}
    `;
  }

  async setupUserSelectOptions() {
    const userSelect = document.getElementById("user-select");
    if (!userSelect) return;

    const users = await dbHelper.getAllUsers();

    userSelect.innerHTML = `
      <option value="">Select User</option>
      <option value="new">Create New User</option>
      ${users
        .map(
          (user) =>
            `<option value="${this.escapeHtml(
              user.full_name
            )}">${this.escapeHtml(user.full_name)}</option>`
        )
        .join("")}
    `;
  }

  updateWordCounts() {
    const fields = [
      { id: "ideal_customer_profile", min: 10, max: 200 },
      { id: "product_idea", min: 15, max: 300 },
      { id: "pain_points", min: 15, max: 250 },
      { id: "alternatives", min: 5, max: 200 },
    ];

    fields.forEach(({ id, min, max }) => {
      const input = document.getElementById(id);
      const counter = document.getElementById(`${id}-count`);

      if (input && counter) {
        const words = input.value
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0);
        const count = words.length;

        counter.textContent = `${count} words (${min}-${max})`;
        counter.className =
          count > max ? "word-counter over-limit" : "word-counter";
      }
    });
  }

  // Fixed submission handling to allow 3 attempts and proper final draft confirmation
  async handleSubmission(e) {
    e.preventDefault();

    console.log("🔧 DEBUG: Starting submission process");

    if (!this.currentUser) {
      this.showMessage("Please select or create a user first", "error");
      return;
    }

    if (!this.currentProject) {
      this.showMessage("Please select or create a project", "error");
      return;
    }

    const formData = new FormData(e.target);

    // Get selected categories (now multi-select)
    const categorySelect = document.getElementById("category");
    const selectedCategories = Array.from(categorySelect.selectedOptions).map(
      (option) => option.value
    );

    const submission = {
      device_id: dbHelper.getDeviceId(),
      full_name: this.currentUser,
      project_name: this.currentProject,
      ideal_customer_profile: formData.get("ideal_customer_profile"),
      product_idea: formData.get("product_idea"),
      pain_points: formData.get("pain_points"),
      alternatives: formData.get("alternatives"),
      category: selectedCategories,
      heard_about: formData.get("heard_about"),
    };

    console.log("🔧 DEBUG: Submission data:", submission);

    // Validate submission
    const validationResult = await validation.validateSubmission(
      submission,
      this.ideas
    );

    if (!validationResult.passed) {
      this.showMessage(validationResult.errors.join(", "), "error");
      return;
    }

    submission.quality_score = validationResult.qualityScore;

    // Determine attempt number for this project (fixed to allow 3 attempts)
    const existingDrafts = await dbHelper.getDraftsByUserAndProject(
      this.currentUser,
      this.currentProject
    );

    // Filter out placeholder drafts (version 0)
    const realDrafts = existingDrafts.filter((d) => d.version > 0);
    const attemptNumber = realDrafts.length + 1;
    submission.version = attemptNumber;

    console.log(
      "🔧 DEBUG: Attempt number:",
      attemptNumber,
      "Real drafts found:",
      realDrafts.length
    );

    try {
      if (attemptNumber <= 2) {
        // Attempts 1 & 2: Save locally + get AI feedback
        console.log(
          "🔧 DEBUG: Processing draft submission (attempt",
          attemptNumber,
          ")"
        );

        const aiFeedback = await supabaseHelper.getAIFeedback(submission);
        submission.ai_feedback = aiFeedback;

        // Update quality score with AI's overall assessment if available
        if (aiFeedback.overall_score) {
          submission.quality_score = aiFeedback.overall_score;
        }

        await dbHelper.saveDraft(submission);

        this.showMessage(
          `Draft ${attemptNumber} saved successfully! AI feedback generated.`,
          "success"
        );
        this.showAIFeedbackModal(aiFeedback);
        this.clearForm();
      } else if (attemptNumber === 3) {
        // Attempt 3: Show confirmation and submit final
        console.log("🔧 DEBUG: Processing final submission (attempt 3)");

        const confirmed = confirm(
          "⚠️ FINAL SUBMISSION WARNING ⚠️\n\nThis is your 3rd and final submission for this project. After submitting:\n• You cannot make any more changes\n• This idea will be saved permanently\n• You cannot submit again for this project\n\nAre you absolutely sure you want to proceed?"
        );

        if (!confirmed) {
          console.log("🔧 DEBUG: Final submission cancelled by user");
          return;
        }

        // Get final AI feedback
        const aiFeedback = await supabaseHelper.getAIFeedback(submission);
        submission.ai_feedback = aiFeedback;
        submission.is_final = true;

        // Update quality score with AI's overall assessment if available
        if (aiFeedback.overall_score) {
          submission.quality_score = aiFeedback.overall_score;
        }

        if (this.isOnline) {
          console.log("🔧 DEBUG: Submitting final idea to Supabase");

          // Submit to Supabase
          try {
            await supabaseHelper.submitFinalIdea(submission);
            await supabaseHelper.createUser(this.currentUser);

            console.log(
              "🔧 DEBUG: Final idea submitted successfully to Supabase"
            );
          } catch (supabaseError) {
            console.error(
              "🔧 DEBUG: Supabase submission failed:",
              supabaseError
            );
            throw supabaseError;
          }

          // Save final draft locally
          await dbHelper.saveDraft(submission);

          this.showMessage(
            "🎉 Idea submitted successfully! Thank you for using Capsera.",
            "success"
          );
          this.showAIFeedbackModal(aiFeedback);
          this.clearForm();
        } else {
          console.log("🔧 DEBUG: Offline - queuing final submission");

          // Queue for later submission
          await dbHelper.saveDraft(submission);
          await dbHelper.addToSyncQueue(submission);
          this.showMessage("Queued for submission when online", "warning");
        }
      } else {
        // More than 3 attempts - should not happen, but safety check
        console.log(
          "🔧 DEBUG: Too many attempts for project:",
          this.currentProject
        );
        this.showMessage(
          "Maximum 3 submission attempts reached for this project. Please create a new project.",
          "error"
        );
      }
    } catch (error) {
      console.error("🔧 DEBUG: Submission error:", error);
      this.showMessage(
        `Submission failed: ${error.message}. Please try again.`,
        "error"
      );
    }
  }

  showAIFeedbackModal(feedback) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";

    // Handle both old and new feedback formats for modal title
    const score = feedback.overall_score || feedback.score;

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>AI Analysis (Score: ${score}/100)</h3>
          <button onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          ${this.renderAIFeedback(feedback)}
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // Screen 4: Settings - Enhanced language switching with loading
  async loadSettingsScreen() {
    this.renderLanguageSelector();
    await this.loadUsersList();
  }

  renderLanguageSelector() {
    const container = document.getElementById("language-selector");
    if (!container) return;

    const currentLang = translator.getCurrentLanguage();

    const html = translator.supportedLangs
      .map(
        (lang) => `
      <div class="language-option ${lang === currentLang ? "selected" : ""}" 
           onclick="app.selectLanguage('${lang}')">
        ${translator.getLanguageName(lang)}
      </div>
    `
      )
      .join("");

    container.innerHTML = html;
  }

  async selectLanguage(lang) {
    if (lang === this.currentLanguage) return;

    // Show loading overlay
    const loadingOverlay = document.createElement("div");
    loadingOverlay.className = "modal-overlay";
    loadingOverlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-body">
          <div class="loading">
            <div class="loading-spinner"></div>
            <p>Updating language... Please wait.</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(loadingOverlay);

    try {
      if (translator.setCurrentLanguage(lang)) {
        this.currentLanguage = lang;
        this.translations = await translator.getTranslations(lang);
        translator.applyTranslations(this.translations);
        this.renderLanguageSelector();
        this.showMessage("Language updated successfully", "success");
      }
    } catch (error) {
      console.error("Language update failed:", error);
      this.showMessage("Failed to update language", "error");
    } finally {
      loadingOverlay.remove();
    }
  }

  async loadUsersList() {
    const container = document.getElementById("users-list");
    if (!container) return;

    try {
      const users = await supabaseHelper.getAllUsers();
      const localUsers = await dbHelper.getAllUsers();

      // Combine and dedupe users
      const allUsers = [...users, ...localUsers].reduce((acc, user) => {
        if (!acc.find((u) => u.full_name === user.full_name)) {
          acc.push(user);
        }
        return acc;
      }, []);

      if (allUsers.length === 0) {
        container.innerHTML = '<div class="text-center">No users found</div>';
        return;
      }

      const html = allUsers
        .map(
          (user) => `
        <div class="user-item">
          <span>${this.escapeHtml(user.full_name)}</span>
          <button class="btn btn-danger btn-sm" 
                  onclick="app.deleteUser('${user.full_name}')">
            Delete
          </button>
        </div>
      `
        )
        .join("");

      container.innerHTML = html;
    } catch (error) {
      console.error("Error loading users:", error);
      container.innerHTML = '<div class="error">Failed to load users</div>';
    }
  }

  // Updated syncOfflineData method as per instructions
  async syncOfflineData() {
    if (!this.isOnline) return;

    console.log("🔧 SYNC: Starting offline data sync");

    // Sync ideas queue (existing code)
    const queue = await dbHelper.getSyncQueue();

    for (const item of queue) {
      try {
        await supabaseHelper.submitFinalIdea(item);
        await supabaseHelper.createUser(item.full_name);
        await dbHelper.removeFromSyncQueue(item.key);
      } catch (error) {
        console.error("Sync failed for item:", item.key, error);
      }
    }

    // NEW: Sync feedback
    try {
      const pendingFeedback = await dbHelper.getPendingFeedback();
      let syncedCount = 0;

      for (const feedback of pendingFeedback) {
        try {
          console.log("🔧 SYNC: Syncing feedback", feedback.id);

          await supabaseHelper.submitFeedback({
            device_id: feedback.device_id,
            message: feedback.message,
            contact_info: feedback.contact_info,
            anonymous: feedback.anonymous,
          });

          await dbHelper.markFeedbackSynced(feedback.id);
          syncedCount++;
        } catch (error) {
          console.error("🔧 SYNC: Failed to sync feedback", feedback.id, error);
        }
      }

      if (syncedCount > 0) {
        console.log(
          `🔧 SYNC: Successfully synced ${syncedCount} feedback submissions`
        );
      }
    } catch (error) {
      console.error("🔧 SYNC: Error during feedback sync:", error);
    }

    const totalSynced = queue.length;
    if (totalSynced > 0) {
      this.showMessage(`Synced ${totalSynced} submissions`, "success");
    }
  }

  showMessage(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 1000;
      padding: 12px 20px; border-radius: 4px; color: white;
      background: ${
        type === "success"
          ? "#28a745"
          : type === "error"
          ? "#dc3545"
          : type === "warning"
          ? "#ffc107"
          : "#17a2b8"
      };
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  formatFeedbackTitle(key) {
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  clearForm() {
    const form = document.getElementById("submit-form");
    if (form) {
      form.reset();
      this.updateWordCounts();
    }
    this.currentProject = null;
  }

  async deleteUser(fullName) {
    const pin = prompt("Enter 4-digit PIN to delete user:");
    if (!pin || pin.length !== 4) return;

    const localUser = await dbHelper.getUser(fullName);
    if (!localUser || dbHelper.hashPin(pin) !== localUser.pin_hash) {
      this.showMessage("Invalid PIN", "error");
      return;
    }

    try {
      await dbHelper.deleteUser(fullName);
      if (this.isOnline) {
        await supabaseHelper.deleteUser(fullName);
      }

      this.showMessage("User deleted", "success");
      this.loadUsersList();
    } catch (error) {
      console.error("Delete user error:", error);
      this.showMessage("Failed to delete user", "error");
    }
  }

  async showUserCreationForm() {
    const name = prompt("Enter your full name:");
    if (!name) return;

    const pin = prompt("Create a 4-digit PIN for this account:");
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      this.showMessage("PIN must be exactly 4 digits", "error");
      return;
    }

    const pinHash = dbHelper.hashPin(pin);
    await dbHelper.saveUser(name, pinHash);

    this.currentUser = name;
    this.setupUserSelectOptions(); // Refresh the dropdown
    this.setupProjectSelectOptions(); // Refresh projects for new user
    this.showMessage(`User ${name} created`, "success");
  }

async selectExistingUser(fullName) {
  const userSelect = document.getElementById("user-select");
  const previousValue = this.currentUser || ""; // Store previous valid selection
  
  const pin = prompt("Enter your 4-digit PIN:");
  if (!pin) {
    // User cancelled - reset dropdown to previous selection
    userSelect.value = previousValue;
    return;
  }

  const localUser = await dbHelper.getUser(fullName);
  if (!localUser || dbHelper.hashPin(pin) !== localUser.pin_hash) {
    this.showMessage("Invalid PIN", "error");
    // Reset dropdown to previous valid selection on authentication failure
    userSelect.value = previousValue;
    return;
  }

  // Only update currentUser if authentication succeeds
  this.currentUser = fullName;
  this.currentProject = null;
  await this.setupProjectSelectOptions(); // Load projects for selected user
  this.showMessage(`Switched to ${fullName}`, "success");
}
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new CapseraApp();
});
