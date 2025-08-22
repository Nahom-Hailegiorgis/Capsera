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
    const selectedValue = e.target.value;
    
    if (selectedValue === "new") {
      this.showUserCreationForm();
    } else if (selectedValue) {
      // Attempt to select existing user
      this.selectExistingUser(selectedValue);
    } else {
      // User selected "Select User" option
      this.currentUser = null;
      this.currentProject = null;
      this.setupProjectSelectOptions(); // This will clear project options
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
    const pin = prompt("Enter your 4-digit PIN:");
    if (!pin) {
      // User cancelled - reset dropdown to previous selection
      this.resetUserDropdownToPrevious();
      return;
    }

    const localUser = await dbHelper.getUser(fullName);
    if (!localUser || dbHelper.hashPin(pin) !== localUser.pin_hash) {
      this.showMessage("Invalid PIN", "error");
      // Reset dropdown to previous selection on invalid PIN
      this.resetUserDropdownToPrevious();
      return;
    }

    // PIN is valid - proceed with user selection
    this.currentUser = fullName;
    this.currentProject = null;
    await this.setupProjectSelectOptions(); // Load projects for selected user
    this.showMessage(`Switched to ${fullName}`, "success");
  }

  resetUserDropdownToPrevious() {
    const userSelect = document.getElementById("user-select");
    if (!userSelect) return;

    // Reset to the current valid user or default
    if (this.currentUser) {
      userSelect.value = this.currentUser;
    } else {
      userSelect.value = ""; // Reset to "Select User"
    }

    // Also clear project selection since user selection failed
    const projectSelect = document.getElementById("project-select");
    if (projectSelect) {
      projectSelect.innerHTML = '<option value="">Select Project</option>';
      this.currentProject = null;
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new CapseraApp();
});
