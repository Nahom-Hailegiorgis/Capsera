// app.js - Enhanced with compact submission cards and autosize textareas
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

  // Enhanced autosize functionality for textareas
  setupTextareaAutosize() {
    const textareas = document.querySelectorAll("textarea");

    textareas.forEach((textarea) => {
      // Remove existing listeners to avoid duplicates
      textarea.removeEventListener("input", this.handleTextareaInput);

      // Add autosize functionality
      const handleInput = (e) => {
        const target = e.target;
        target.style.height = "auto";
        target.style.height = target.scrollHeight + "px";
      };

      textarea.addEventListener("input", handleInput);

      // Initial size adjustment
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    });
  }

  // Enhanced card toggle functionality
  setupSubmissionCardToggles() {
    const cards = document.querySelectorAll(".submission-card");

    cards.forEach((card) => {
      const chevron = card.querySelector(".submission-card-chevron");
      const header = card.querySelector(".submission-card-header");

      if (!chevron) return;

      // Remove existing listeners
      chevron.removeEventListener("click", this.handleCardToggle);
      header.removeEventListener("click", this.handleCardToggle);

      const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isExpanded = card.classList.contains("submission-card--expanded");

        if (isExpanded) {
          card.classList.remove("submission-card--expanded");
          chevron.setAttribute("aria-expanded", "false");
        } else {
          card.classList.add("submission-card--expanded");
          chevron.setAttribute("aria-expanded", "true");
        }
      };

      chevron.addEventListener("click", handleToggle);
      header.addEventListener("click", handleToggle);
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

  // Enhanced submission handling with new field compatibility layer
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

    // NEW COMPATIBILITY LAYER: Read both old and new field names
    const getFieldValue = (newName, oldName) => {
      const newValue = formData.get(newName);
      const oldValue = formData.get(oldName);

      if (oldValue && !newValue) {
        console.warn(
          `⚠️ MIGRATION WARNING: Using deprecated field name '${oldName}'. Update to '${newName}'.`
        );
        return oldValue;
      }
      return newValue || oldValue || "";
    };

    // Get selected categories (now multi-select) - handle both old and new
    const categorySelect =
      document.getElementById("categories") ||
      document.getElementById("category");
    const selectedCategories = Array.from(categorySelect.selectedOptions).map(
      (option) => option.value
    );

    const submission = {
      device_id: dbHelper.getDeviceId(),
      full_name: this.currentUser,
      project_name: this.currentProject,
      // NEW field names with backwards compatibility
      ideal_customer_profile: getFieldValue(
        "customer_profile",
        "ideal_customer_profile"
      ),
      product_idea: getFieldValue("main_idea", "product_idea"),
      pain_points: getFieldValue("problems_solved", "pain_points"),
      alternatives: getFieldValue("competitive_landscape", "alternatives"),
      category: selectedCategories,
      heard_about: getFieldValue("discovery_source", "heard_about"),
    };

    // Log the mapping for debugging
    console.log("🔧 DEBUG: Field mapping applied:", {
      customer_profile: submission.ideal_customer_profile?.length || 0,
      main_idea: submission.product_idea?.length || 0,
      problems_solved: submission.pain_points?.length || 0,
      competitive_landscape: submission.alternatives?.length || 0,
      categories: submission.category?.length || 0,
    });

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

  setupFeedbackForm() {
    console.log("🔧 FEEDBACK: Setting up feedback form");

    // Use a small delay to ensure DOM has updated after innerHTML changes
    const trySetupForm = () => {
      const form = document.getElementById("feedback-form");
      if (!form) {
        console.error("🔧 FEEDBACK: Form element not found!");
        return false;
      }

      // Remove existing listeners to avoid duplicates
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);
      console.log("🔧 FEEDBACK: Form listener attached successfully");

      newForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("🔧 FEEDBACK: Form submission started");

        // Re-query elements from the new form to ensure they exist
        const messageInput = newForm.querySelector("#feedback-message");
        const contactInput = newForm.querySelector("#feedback-contact");
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

      return true; // Success
    };

    // Try immediately first
    if (trySetupForm()) {
      return;
    }

    // If form not found, try again after a short delay to allow DOM to update
    setTimeout(() => {
      if (!trySetupForm()) {
        // If still not found after delay, try once more with a longer delay
        setTimeout(() => {
          trySetupForm();
        }, 100);
      }
    }, 10);
  }
}
