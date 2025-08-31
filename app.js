// app.js - Enhanced Capsera PWA with dynamic forms and compact UI
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
    this.currentDraftNumber = 1;
    this.expandedSubmissions = new Set(); // Track expanded submissions

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.registerServiceWorker();
    this.translations = await translator.init();
    await this.loadIdeasScreen();
    this.showScreen("ideas");
    setInterval(() => this.syncOfflineData(), 30000);
  }

  setupEventListeners() {
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
        const screen = e.target.getAttribute("data-screen") ||
          e.target.closest("[data-screen]")?.getAttribute("data-screen");
        if (screen) {
          this.showScreen(screen);
        }
      });
    });

    // Dynamic textarea auto-expand
    document.addEventListener("input", (e) => {
      if (e.target.classList.contains("auto-expand")) {
        this.autoExpandTextarea(e.target);
      }
    });
  }

  // Auto-expand textarea functionality
  autoExpandTextarea(textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    // Set the height to match the content
    textarea.style.height = textarea.scrollHeight + "px";
    
    // Minimum height constraint
    if (textarea.scrollHeight < 60) {
      textarea.style.height = "60px";
    }
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

  // Screen 1: Ideas List (unchanged)
  async loadIdeasScreen() {
    const container = document.getElementById("ideas-list");
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading ideas...</div>';

    try {
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
      .map((idea) => `
        <div class="idea-item" onclick="app.viewIdeaDetails('${idea.id}')">
          <div class="idea-title">${this.escapeHtml(idea.preview || "Untitled Idea")}</div>
          <div class="idea-meta">
            By ${this.escapeHtml(idea.full_name)} • ${
              Array.isArray(idea.category) ? idea.category.join(", ") : idea.category || "Uncategorized"
            } • 
            ${new Date(idea.created_at).toLocaleDateString()}
          </div>
        </div>
      `).join("");

    container.innerHTML = html + this.getFeedbackFormHTML();
  }

  getFeedbackFormHTML() {
    return `
      <div class="feedback-section">
        <h3>Share Your Feedback</h3>
        <form id="feedback-form" class="feedback-form">
          <div class="form-group">
            <label class="form-label">How can we improve Capsera?</label>
            <textarea id="feedback-message" class="form-textarea auto-expand" 
                     placeholder="Tell us what you think..."></textarea>
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
    // Setup feedback form (existing logic with validation name-based approach)
    const trySetupForm = () => {
      const form = document.getElementById("feedback-form");
      if (!form) return false;

      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);

      newForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const messageInput = newForm.querySelector("#feedback-message");
        const contactInput = newForm.querySelector("#feedback-contact");
        const submitButton = newForm.querySelector('button[type="submit"]');

        const message = messageInput?.value?.trim();
        const contact = contactInput?.value?.trim();

        // Name-based validation instead of HTML5 required attribute
        if (!message) {
          this.showMessage("feedback_message is required", "error");
          return;
        }

        const originalText = submitButton?.textContent || "Submit Feedback";
        if (submitButton) {
          submitButton.textContent = "Submitting...";
          submitButton.disabled = true;
        }

        try {
          const feedbackData = {
            device_id: dbHelper.getDeviceId(),
            message: message,
            contact_info: contact || null,
            anonymous: !contact,
          };

          // TODO: Call supabaseHelper.submitFeedback(feedbackData)
          // const result = await supabaseHelper.submitFeedback(feedbackData);

          this.showMessage("Thank you for your feedback!", "success");
          newForm.reset();
        } catch (error) {
          console.error("Feedback submission failed:", error);
          this.showMessage("Failed to submit feedback. Please try again.", "error");
        } finally {
          if (submitButton) {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
          }
        }
      });

      return true;
    };

    if (trySetupForm()) return;
    setTimeout(() => {
      if (!trySetupForm()) {
        setTimeout(() => trySetupForm(), 100);
      }
    }, 10);
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
      // TODO: Call supabaseHelper.getIdeaDetails(ideaId)
      const result = { restricted: true, message: "Detailed view coming soon!" };

      const modalBody = modal.querySelector(".modal-body");

      if (result.restricted) {
        modalBody.innerHTML = `
          <div class="text-center">
            <p>${result.message || "Detailed view is not available at this time."}</p>
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
              Categories: ${Array.isArray(idea.category) ? idea.category.join(", ") : idea.category || "None"} • 
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

  // Screen 2: My Submissions - Compact Design with Expand/Collapse
  async loadSubmissionsScreen() {
    const container = document.getElementById("submissions-list");
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading submissions...</div>';

    const drafts = await dbHelper.getAllDrafts();

    if (drafts.length === 0) {
      container.innerHTML = '<div class="text-center">No submissions yet</div>';
      return;
    }

    // Group by user and project
    const userGroups = {};
    drafts.forEach((draft) => {
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
        <div class="user-section-compact">
          <div class="user-header-compact">${this.escapeHtml(userName)}</div>
          ${Object.entries(userProjects)
            .map(([projectName, projectDrafts]) => {
              const latestDraft = projectDrafts.sort((a, b) => b.version - a.version)[0];
              const submissionId = `${userName}-${projectName}`;
              const isExpanded = this.expandedSubmissions.has(submissionId);
              
              return `
                <div class="submission-compact">
                  <div class="submission-header-compact" onclick="app.toggleSubmissionDetails('${submissionId}')">
                    <div class="submission-summary">
                      <div class="submission-title">${this.escapeHtml(projectName)}</div>
                      <div class="submission-preview">${this.escapeHtml((latestDraft.product_idea || "").substring(0, 80))}${latestDraft.product_idea && latestDraft.product_idea.length > 80 ? "..." : ""}</div>
                    </div>
                    <div class="expand-arrow ${isExpanded ? "expanded" : ""}">${isExpanded ? "▼" : "▶"}</div>
                  </div>
                  <div class="submission-details ${isExpanded ? "expanded" : ""}" id="details-${submissionId}">
                    ${projectDrafts.map(draft => this.renderSubmissionItem(draft, projectName)).join("")}
                  </div>
                </div>
              `;
            }).join("")}
        </div>
      `;
    });

    container.innerHTML = html;
  }

  toggleSubmissionDetails(submissionId) {
    const detailsElement = document.getElementById(`details-${submissionId}`);
    const arrowElement = document.querySelector(`[onclick="app.toggleSubmissionDetails('${submissionId}')"] .expand-arrow`);
    
    if (this.expandedSubmissions.has(submissionId)) {
      this.expandedSubmissions.delete(submissionId);
      detailsElement.classList.remove("expanded");
      arrowElement.classList.remove("expanded");
      arrowElement.textContent = "▶";
    } else {
      this.expandedSubmissions.add(submissionId);
      detailsElement.classList.add("expanded");
      arrowElement.classList.add("expanded");
      arrowElement.textContent = "▼";
    }
  }

  renderSubmissionItem(draft, projectName) {
    const statusText = draft.is_final ? "Final Submission" : `Draft v${draft.version}`;
    const statusClass = draft.is_final ? "success" : "warning";
    const aiScore = draft.ai_feedback?.overall_score || draft.ai_feedback?.score;

    return `
      <div class="submission-item-compact">
        <div class="submission-meta-compact">
          <span class="status ${statusClass}">${statusText}</span>
          <span class="submission-date">${new Date(draft.saved_at).toLocaleDateString()}</span>
          ${aiScore ? `<span class="ai-score">AI: ${aiScore}/100</span>` : ""}
        </div>
        ${this.renderAIFeedback(draft.ai_feedback)}
      </div>
    `;
  }

  // Screen 3: Enhanced Submit Ideas with Dynamic Forms
  loadSubmitScreen() {
    this.updateGreeting();
    this.setupSubmitForm();
    this.updateWordCounts();
    this.setupUserSelectOptions();
    this.setupCategoryMultiSelect();
    this.checkCooldownStatus();
  }

  updateGreeting() {
    const greetingElement = document.getElementById("greeting-text");
    if (greetingElement) {
      const userName = this.currentUser || "there";
      const greetings = [
        `Hey ${userName}! Ready to share your idea?`,
        `What's cooking, ${userName}?`,
        `Time to make magic happen, ${userName}!`,
        `Let's build something amazing, ${userName}!`
      ];
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      greetingElement.textContent = randomGreeting;
    }
  }

  async checkCooldownStatus() {
    if (!this.currentUser || !this.currentProject) return;

    // TODO: Check first_draft_submitted_at from database
    // const drafts = await dbHelper.getDraftsByUserAndProject(this.currentUser, this.currentProject);
    // const firstDraft = drafts.find(d => d.version === 1);
    
    const cooldownElement = document.getElementById("cooldown-message");
    const cooldownDaysElement = document.getElementById("cooldown-days");
    
    // Placeholder logic - replace with actual database check
    const showCooldown = false; // Replace with actual cooldown check
    
    if (showCooldown) {
      const cooldownDays = window.ENV.DRAFT_COOLDOWN_DAYS || 7;
      cooldownElement.classList.remove("hidden");
      if (cooldownDaysElement) {
        cooldownDaysElement.textContent = cooldownDays;
      }
    } else {
      cooldownElement.classList.add("hidden");
    }
  }

  setupSubmitForm() {
    const form = document.getElementById("submit-form");
    if (!form) return;

    // Remove existing listeners to avoid duplicates
    form.removeEventListener("submit", this.handleSubmissionBound);
    this.handleSubmissionBound = this.handleSubmission.bind(this);
    form.addEventListener("submit", this.handleSubmissionBound);

    // Word count listeners for auto-expanding textareas
    form.querySelectorAll('textarea, input[type="text"]').forEach((input) => {
      input.removeEventListener("input", this.updateWordCountsBound);
      this.updateWordCountsBound = this.updateWordCounts.bind(this);
      input.addEventListener("input", this.updateWordCountsBound);
      
      // Initialize auto-expand for textareas
      if (input.classList.contains("auto-expand")) {
        this.autoExpandTextarea(input);
      }
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
      projectSelect.removeEventListener("change", this.handleProjectSelectBound);
      this.handleProjectSelectBound = this.handleProjectSelect.bind(this);
      projectSelect.addEventListener("change", this.handleProjectSelectBound);
    }
  }

  setupCategoryMultiSelect() {
    const categorySelect = document.getElementById("category");
    if (!categorySelect) return;
    categorySelect.multiple = true;
    categorySelect.size = 5;
  }

  handleUserSelect(e) {
    const selectedValue = e.target.value;
    
    if (selectedValue === "new") {
      this.showUserCreationForm();
    } else if (selectedValue) {
      this.selectExistingUser(selectedValue);
    } else {
      this.currentUser = null;
      this.currentProject = null;
      this.setupProjectSelectOptions();
    }
    
    this.updateGreeting();
    this.checkCooldownStatus();
  }

  handleProjectSelect(e) {
    if (e.target.value === "new") {
      this.createNewProject();
    } else {
      this.currentProject = e.target.value;
    }
    this.checkCooldownStatus();
  }

  async createNewProject() {
    const projectName = prompt("What's your project name?");
    if (!projectName) return;

    this.currentProject = projectName;

    // Save placeholder draft
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
      version: 0,
      is_final: false,
    });

    await this.setupProjectSelectOptions();
    this.showMessage(`Project "${projectName}" created!`, "success");
  }

  async setupProjectSelectOptions() {
    const projectSelect = document.getElementById("project-select");
    if (!projectSelect || !this.currentUser) return;

    const userDrafts = await dbHelper.getDraftsByUser(this.currentUser);
    const projects = [...new Set(userDrafts.map((d) => d.project_name || "Default Project"))];

    projectSelect.innerHTML = `
      <option value="">Select Project</option>
      <option value="new">Create New Project</option>
      ${projects.map(project => `
        <option value="${this.escapeHtml(project)}" ${project === this.currentProject ? "selected" : ""}>
          ${this.escapeHtml(project)}
        </option>
      `).join("")}
    `;
  }

  async setupUserSelectOptions() {
    const userSelect = document.getElementById("user-select");
    if (!userSelect) return;

    const users = await dbHelper.getAllUsers();

    userSelect.innerHTML = `
      <option value="">Select User</option>
      <option value="new">Create New User</option>
      ${users.map(user => `
        <option value="${this.escapeHtml(user.full_name)}">${this.escapeHtml(user.full_name)}</option>
      `).join("")}
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
        const words = input.value.trim().split(/\s+/).filter((w) => w.length > 0);
        const count = words.length;

        counter.textContent = `${count} words (${min}-${max})`;
        counter.className = count > max ? "word-counter over-limit" : "word-counter";
      }
    });
  }

  // Enhanced submission handling with draft progression
  async handleSubmission(e) {
    e.preventDefault();

    if (!this.currentUser) {
      this.showMessage("Please select who you are first!", "error");
      return;
    }

    if (!this.currentProject) {
      this.showMessage("Please select or create a project", "error");
      return;
    }

    const formData = new FormData(e.target);
    const categorySelect = document.getElementById("category");
    const selectedCategories = Array.from(categorySelect.selectedOptions).map(option => option.value);

    // Build submission object with field names for validation
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
      // Draft 2 fields
      market_validation: formData.get("market_validation"),
      competitor_research: formData.get("competitor_research"),
      mvp_development: formData.get("mvp_development"),
      // Draft 3 fields
      investor_pitch: formData.get("investor_pitch"),
      additional_research: formData.get("additional_research"),
      mvp_link: formData.get("mvp_link"),
    };

    // Validate using field names instead of HTML5 required
    const validationResult = await validation.validateSubmission(submission, this.ideas);

    if (!validationResult.passed) {
      this.showMessage(validationResult.errors.join(", "), "error");
      return;
    }

    submission.quality_score = validationResult.qualityScore;

    // Determine draft number
    const existingDrafts = await dbHelper.getDraftsByUserAndProject(this.currentUser, this.currentProject);
    const realDrafts = existingDrafts.filter((d) => d.version > 0);
    const attemptNumber = realDrafts.length + 1;
    submission.version = attemptNumber;

    try {
      if (attemptNumber <= 2) {
        // Draft submissions
        // TODO: const aiFeedback = await supabaseHelper.getAIFeedback(submission);
        // submission.ai_feedback = aiFeedback;

        if (attemptNumber === 1) {
          // TODO: Store first_draft_submitted_at timestamp in database
          submission.first_draft_submitted_at = new Date().toISOString();
        }

        await dbHelper.saveDraft(submission);
        
        this.showMessage(`Draft ${attemptNumber} saved! AI feedback coming soon.`, "success");
        this.clearForm();
        this.checkCooldownStatus();
        
      } else if (attemptNumber === 3) {
        // Final submission
        const confirmed = confirm("This is your final submission! Are you sure you're ready?");
        
        if (!confirmed) return;

        submission.is_final = true;

        if (this.isOnline) {
          // TODO: await supabaseHelper.submitFinalIdea(submission);
          // TODO: await supabaseHelper.createUser(this.currentUser);
        } else {
          await dbHelper.addToSyncQueue(submission);
        }

        await dbHelper.saveDraft(submission);
        this.showMessage("Idea submitted successfully! Thank you!", "success");
        this.clearForm();
        
      } else {
        this.showMessage("Maximum submissions reached for this project.", "error");
      }
    } catch (error) {
      console.error("Submission error:", error);
      this.showMessage(`Submission failed: ${error.message}`, "error");
    }
  }

  // Enhanced AI Feedback Rendering
  renderAIFeedback(feedback) {
    if (!feedback) return "";

    if (feedback.critique && feedback.suggestions && feedback.grading) {
      return this.renderStructuredAIFeedback(feedback);
    } else {
      return this.renderLegacyAIFeedback(feedback);
    }
  }

  renderStructuredAIFeedback(feedback) {
    return `
      <div class="ai-feedback-compact">
        <div class="feedback-header">
          <span class="ai-badge">AI Analysis</span>
          <span class="score-badge">${feedback.overall_score}/100</span>
        </div>
        <div class="feedback-summary">
          <strong>Key Points:</strong>
          <ul class="feedback-bullets">
            ${feedback.critique.strengths.slice(0, 2).map(strength => `<li class="strength">+ ${this.escapeHtml(strength)}</li>`).join("")}
            ${feedback.critique.weaknesses.slice(0, 2).map(weakness => `<li class="weakness">- ${this.escapeHtml(weakness)}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;
  }

  renderLegacyAIFeedback(feedback) {
    return `
      <div class="ai-feedback-compact">
        <div class="feedback-header">
          <span class="ai-badge">AI Feedback</span>
          <span class="score-badge">${feedback.score}/100</span>
        </div>
        <div class="feedback-summary">
          ${Object.entries(feedback).filter(([key]) => key !== "score").slice(0, 1).map(([key, bullets]) => `
            <strong>${this.formatFeedbackTitle(key)}:</strong>
            <ul class="feedback-bullets">
              ${bullets.slice(0, 3).map(bullet => `<li>${this.escapeHtml(bullet)}</li>`).join("")}
            </ul>
          `).join("")}
        </div>
      </div>
    `;
  }

  // Screen 4: Settings (simplified)
  async loadSettingsScreen() {
    this.renderLanguageSelector();
    await this.loadUsersList();
  }

  renderLanguageSelector() {
    const container = document.getElementById("language-selector");
    if (!container) return;

    const currentLang = translator.getCurrentLanguage();
    const html = translator.supportedLangs.map(lang => `
      <div class="language-option ${lang === currentLang ? "selected" : ""}" 
           onclick="app.selectLanguage('${lang}')">
        ${translator.getLanguageName(lang)}
      </div>
    `).join("");

    container.innerHTML = html;
  }

  async selectLanguage(lang) {
    if (lang === this.currentLanguage) return;

    const loadingOverlay = document.createElement("div");
    loadingOverlay.className = "modal-overlay";
    loadingOverlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-body">
          <div class="loading">
            <div class="loading-spinner"></div>
            <p>Updating language...</p>
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
        this.showMessage("Language updated!", "success");
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
      // TODO: const users = await supabaseHelper.getAllUsers();
      const localUsers = await dbHelper.getAllUsers();
      const allUsers = localUsers; // Combine with remote users when available

      if (allUsers.length === 0) {
        container.innerHTML = '<div class="text-center">No users found</div>';
        return;
      }

      const html = allUsers.map(user => `
        <div class="user-item">
          <span>${this.escapeHtml(user.full_name)}</span>
          <button class="btn btn-danger btn-sm" onclick="app.deleteUser('${user.full_name}')">
            Delete
          </button>
        </div>
      `).join("");

      container.innerHTML = html;
    } catch (error) {
      console.error("Error loading users:", error);
      container.innerHTML = '<div class="error">Failed to load users</div>';
    }
  }

  // Utility methods
  async syncOfflineData() {
    if (!this.isOnline) return;

    const queue = await dbHelper.getSyncQueue();
    let syncedCount = 0;

    for (const item of queue) {
      try {
        // TODO: await supabaseHelper.submitFinalIdea(item);
        // TODO: await supabaseHelper.createUser(item.full_name);
        await dbHelper.removeFromSyncQueue(item.key);
        syncedCount++;
      } catch (error) {
        console.error("Sync failed for item:", item.key, error);
      }
    }

    if (syncedCount > 0) {
      this.showMessage(`Synced ${syncedCount} submissions`, "success");
    }
  }

  showMessage(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 1001;
      padding: 12px 20px; border-radius: 4px; color: white;
      background: ${type === "success" ? "#28a745" : type === "error" ? "#dc3545" : type === "warning" ? "#ffc107" : "#17a2b8"};
      font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  formatFeedbackTitle(key) {
    return key.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }

  clearForm() {
    const form = document.getElementById("submit-form");
    if (form) {
      form.reset();
      // Reset auto-expand textareas
      form.querySelectorAll(".auto-expand").forEach(textarea => {
        textarea.style.height = "auto";
        this.autoExpandTextarea(textarea);
      });
      this.updateWordCounts();
    }
    this.currentProject = null;
  }

  async deleteUser(fullName) {
    const pin = prompt("Enter your 4-digit PIN:");
    if (!pin || pin.length !== 4) return;

    const localUser = await dbHelper.getUser(fullName);
    if (!localUser || dbHelper.hashPin(pin) !== localUser.pin_hash) {
      this.showMessage("Invalid PIN", "error");
      return;
    }

    try {
      await dbHelper.deleteUser(fullName);
      // TODO: if (this.isOnline) await supabaseHelper.deleteUser(fullName);
      
      this.showMessage("User deleted", "success");
      this.loadUsersList();
    } catch (error) {
      console.error("Delete user error:", error);
      this.showMessage("Failed to delete user", "error");
    }
  }

  async showUserCreationForm() {
    const name = prompt("What's your full name?");
    if (!name) return;

    const pin = prompt("Create a 4-digit PIN:");
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      this.showMessage("PIN must be exactly 4 digits", "error");
      return;
    }

    const pinHash = dbHelper.hashPin(pin);
    await dbHelper.saveUser(name, pinHash);

    this.currentUser = name;
    this.setupUserSelectOptions();
    this.setupProjectSelectOptions();
    this.updateGreeting();
    this.showMessage(`Welcome, ${name}!`, "success");
  }

  async selectExistingUser(fullName) {
    const pin = prompt("Enter your PIN:");
    if (!pin) {
      this.resetUserDropdownToPrevious();
      return;
    }

    const localUser = await dbHelper.getUser(fullName);
    if (!localUser || dbHelper.hashPin(pin) !== localUser.pin_hash) {
      this.showMessage("Invalid PIN", "error");
      this.resetUserDropdownToPrevious();
      return;
    }

    this.currentUser = fullName;
    this.currentProject = null;
    await this.setupProjectSelectOptions();
    this.showMessage(`Welcome back, ${fullName}!`, "success");
  }

  resetUserDropdownToPrevious() {
    const userSelect = document.getElementById("user-select");
    if (!userSelect) return;

    userSelect.value = this.currentUser || "";
    
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

// Add CSS animation for toast
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(style);
