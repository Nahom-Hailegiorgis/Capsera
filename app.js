// Fixed version of app.js - Enhanced Capsera PWA with offline capabilities and version checking 
import { dbHelper } from "./db.js";
import { supabaseHelper } from "./supabase.js";
import { validation } from "./validation.js";
import { translator } from "./translate.js";

class CapseraApp {
  constructor() {
    this.currentScreen = "ideas";
    this.currentUser = null;
    this.currentProject = null;
    this.currentUserId = null;
    this.projects = [];
    this.currentLanguage = "en";
    this.translations = null;
    this.ideas = [];
    this.isOnline = navigator.onLine;
    this.currentDraftNumber = 1;
    this.expandedSubmissions = new Set();
    this.offlineBanner = null;
    this.lastKnownVersion = null;

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.registerServiceWorker();
    this.translations = await translator.init();
    await this.loadIdeasScreen();
    this.showScreen("ideas");
    
    // Check for app version updates
    await this.checkForAppUpdates();
    
    // Set up periodic sync
    setInterval(() => this.syncOfflineData(), 30000);
    this.syncOfflineProjects();
    
    // Initialize offline banner
    this.updateOfflineStatus();
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
      this.updateOfflineStatus();
      this.syncOfflineData();
      this.syncOfflineProjects();
      this.showMessage(this.t("Connection restored - syncing data..."), "success");
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.updateOfflineStatus();
      this.showMessage(this.t("Working offline - drafts will be saved locally"), "warning");
    });

    // Service worker messages
    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        this.handleServiceWorkerMessage(event.data);
      });
    }

    // Before unload - save current form data as draft
    window.addEventListener("beforeunload", () => {
      this.saveCurrentFormAsDraft();
    });
  }

  // Handle service worker messages
  handleServiceWorkerMessage(data) {
    switch (data.type) {
      case 'NEW_VERSION_AVAILABLE':
        this.handleNewVersionAvailable(data.version);
        break;
      case 'SYNC_OFFLINE_DATA':
        this.syncOfflineData();
        this.syncOfflineProjects();
        break;
      default:
        console.log('Unknown SW message:', data);
    }
  }

  // Handle new version available
  async handleNewVersionAvailable(newVersion) {
    if (this.lastKnownVersion && this.lastKnownVersion !== newVersion) {
      const shouldReload = confirm(
        this.t("A new version of Capsera is available. Reload to update?")
      );
      
      if (shouldReload) {
        // Save current form data before reloading
        await this.saveCurrentFormAsDraft();
        window.location.reload();
      }
    }
    this.lastKnownVersion = newVersion;
  }

  // Check for app updates by comparing manifest version
  async checkForAppUpdates() {
    try {
      // Get current version from manifest
      const response = await fetch('/manifest.json', { cache: 'no-store' });
      const manifest = await response.json();
      const currentVersion = manifest.version;
      
      // Get stored version
      const storedVersion = await dbHelper.getSetting('app_version');
      
      if (storedVersion && storedVersion !== currentVersion) {
        console.log(`App updated from ${storedVersion} to ${currentVersion}`);
        this.showMessage(this.t("App updated to latest version!"), "success");
      }
      
      // Store current version
      await dbHelper.saveSetting('app_version', currentVersion);
      this.lastKnownVersion = currentVersion;
      
    } catch (error) {
      console.error('Version check failed:', error);
    }
  }

  // Update offline status banner
  updateOfflineStatus() {
    if (!this.isOnline) {
      this.showOfflineBanner();
    } else {
      this.hideOfflineBanner();
    }
  }

  showOfflineBanner() {
    if (this.offlineBanner) return;
    
    this.offlineBanner = document.createElement('div');
    this.offlineBanner.className = 'offline-banner';
    this.offlineBanner.innerHTML = `
      <div class="offline-content">
        📡 ${this.t("You are offline — drafts saved locally")}
        <button onclick="app.hideOfflineBanner()" class="offline-dismiss">×</button>
      </div>
    `;
    this.offlineBanner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      background: #ffc107; color: #212529; padding: 10px;
      text-align: center; font-weight: 500;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      animation: slideDown 0.3s ease;
    `;
    
    document.body.insertBefore(this.offlineBanner, document.body.firstChild);
    
    // Adjust content padding to account for banner
    document.body.style.paddingTop = '50px';
  }

  hideOfflineBanner() {
    if (this.offlineBanner) {
      this.offlineBanner.remove();
      this.offlineBanner = null;
      document.body.style.paddingTop = '0';
    }
  }

  // Save current form data as draft
  async saveCurrentFormAsDraft() {
    if (this.currentScreen !== 'submit' || !this.currentUser || !this.currentProject) {
      return;
    }

    try {
      const form = document.getElementById("submit-form");
      if (!form) return;

      const formData = new FormData(form);
      const categorySelect = document.getElementById("category");
      const selectedCategories = Array.from(categorySelect?.selectedOptions || []).map(option => option.value);

      // Check if form has any meaningful content
      const hasContent = formData.get("ideal_customer_profile") || 
                        formData.get("product_idea") || 
                        formData.get("pain_points") || 
                        formData.get("alternatives");

      if (!hasContent) return;

      const draftData = {
        device_id: dbHelper.getDeviceId(),
        full_name: this.currentUser,
        user_id: this.currentUserId,
        project_name: this.currentProject,
        ideal_customer_profile: formData.get("ideal_customer_profile") || "",
        product_idea: formData.get("product_idea") || "",
        pain_points: formData.get("pain_points") || "",
        alternatives: formData.get("alternatives") || "",
        category: selectedCategories,
        heard_about: formData.get("heard_about") || "",
        market_validation: formData.get("market_validation") || "",
        competitor_research: formData.get("competitor_research") || "",
        mvp_development: formData.get("mvp_development") || "",
        investor_pitch: formData.get("investor_pitch") || "",
        additional_research: formData.get("additional_research") || "",
        mvp_link: formData.get("mvp_link") || "",
        version: 0, // Version 0 indicates auto-saved draft
        is_final: false,
        needs_sync: !this.isOnline,
        auto_saved: true,
        saved_at: new Date().toISOString()
      };

      await dbHelper.saveDraft(draftData);
      console.log('Auto-saved draft for', this.currentUser, this.currentProject);
      
    } catch (error) {
      console.error('Failed to auto-save draft:', error);
    }
  }

  // Restore auto-saved draft
  async restoreAutoSavedDraft() {
    if (!this.currentUser || !this.currentProject) return;

    try {
      const drafts = await dbHelper.getDraftsByUserAndProject(this.currentUser, this.currentProject);
      const autoSaved = drafts.find(d => d.auto_saved && d.version === 0);
      
      if (!autoSaved) return;

      const shouldRestore = confirm(
        this.t("We found an auto-saved draft. Would you like to restore it?")
      );
      
      if (!shouldRestore) {
        // Delete the auto-saved draft if user doesn't want it
        await dbHelper.deleteDraft(autoSaved.id);
        return;
      }

      this.populateFormWithDraft(autoSaved);
      this.showMessage(this.t("Draft restored successfully!"), "success");
      
      // Delete the auto-saved draft after restoring
      await dbHelper.deleteDraft(autoSaved.id);
      
    } catch (error) {
      console.error('Failed to restore auto-saved draft:', error);
    }
  }

  // Populate form with draft data
  populateFormWithDraft(draft) {
    const form = document.getElementById("submit-form");
    if (!form) return;

    // Fill text inputs
    const textFields = [
      'ideal_customer_profile', 'product_idea', 'pain_points', 'alternatives',
      'market_validation', 'competitor_research', 'mvp_development', 
      'investor_pitch', 'additional_research', 'mvp_link', 'heard_about'
    ];

    textFields.forEach(fieldName => {
      const field = document.getElementById(fieldName);
      if (field && draft[fieldName]) {
        field.value = draft[fieldName];
        if (field.classList.contains('auto-expand')) {
          this.autoExpandTextarea(field);
        }
      }
    });

    // Fill category selection
    const categorySelect = document.getElementById("category");
    if (categorySelect && draft.category) {
      Array.from(categorySelect.options).forEach(option => {
        option.selected = draft.category.includes(option.value);
      });
    }

    this.updateWordCounts();
  }

  // Translation helper method
  t(key) {
    if (!this.translations || !this.translations.ui) {
      return key;
    }
    const translated = this.translations.ui[key];
    if (!translated) {
      console.warn(`🌐 Missing translation for "${key}"`);
      return key;
    }
    return translated;
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

    // Auto-save form data while typing (debounced)
    let autoSaveTimeout;
    document.addEventListener("input", (e) => {
      if (e.target.closest("#submit-form")) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
          this.saveCurrentFormAsDraft();
        }, 2000); // Auto-save after 2 seconds of inactivity
      }
    });
  }

  // Auto-expand textarea functionality
  autoExpandTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
    
    if (textarea.scrollHeight < 60) {
      textarea.style.height = "60px";
    }
  }

  async registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("SW registered:", registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('New SW activated');
            }
          });
        });
        
      } catch (error) {
        console.error("SW registration failed:", error);
      }
    }
  }

  showScreen(screenName) {
    // Save current form data before switching screens
    if (this.currentScreen === 'submit') {
      this.saveCurrentFormAsDraft();
    }

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

    container.innerHTML = `<div class="loading">${this.t("Loading ideas...")}</div>`;

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
      
      // Try to load from cache on error
      try {
        const cached = await dbHelper.getCachedIdeas();
        this.ideas = cached || [];
        this.renderIdeasList();
        this.setupFeedbackForm();
        this.showMessage(this.t("Loaded cached ideas (offline mode)"), "warning");
      } catch (cacheError) {
        container.innerHTML = '<div class="error">Failed to load ideas</div>';
      }
    }
  }

  renderIdeasList() {
    const container = document.getElementById("ideas-list");
    if (!container) return;

    if (this.ideas.length === 0) {
      const message = this.isOnline ? 
        this.t("No ideas found") : 
        this.t("No cached ideas available offline");
      container.innerHTML = `<div class="text-center">${message}</div>`;
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
        <h3>${this.t("Share Your Feedback")}</h3>
        <form id="feedback-form" class="feedback-form">
          <div class="form-group">
            <label class="form-label">${this.t("How can we improve Capsera?")}</label>
            <textarea id="feedback-message" class="form-textarea auto-expand" 
                     placeholder="${this.t("Tell us what you think...")}"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">${this.t("Contact (Optional)")}</label>
            <input type="text" id="feedback-contact" class="form-input" 
                   placeholder="${this.t("Email or phone (optional)")}">
          </div>
          <button type="submit" class="btn btn-primary" ${!this.isOnline ? 'disabled' : ''}>
            ${this.t("Submit Feedback")}${!this.isOnline ? ` (${this.t("Offline")})` : ''}
          </button>
        </form>
      </div>
    `;
  }

  setupFeedbackForm() {
    const trySetupForm = () => {
      const form = document.getElementById("feedback-form");
      if (!form) return false;

      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);

      newForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!this.isOnline) {
          this.showMessage(this.t("Feedback submission requires internet connection"), "error");
          return;
        }

        const messageInput = newForm.querySelector("#feedback-message");
        const contactInput = newForm.querySelector("#feedback-contact");
        const submitButton = newForm.querySelector('button[type="submit"]');

        const message = messageInput?.value?.trim();
        const contact = contactInput?.value?.trim();

        if (!message) {
          this.showMessage(this.t("Please enter your feedback message"), "error");
          return;
        }

        const originalText = submitButton?.textContent || this.t("Submit Feedback");
        if (submitButton) {
          submitButton.textContent = this.t("Submitting...");
          submitButton.disabled = true;
        }

        try {
          const feedbackData = {
            device_id: dbHelper.getDeviceId(),
            message: message,
            contact_info: contact || null,
            anonymous: !contact,
          };

          // FIXED: Store locally first for offline support with proper validation
          await dbHelper.saveFeedback(feedbackData);
          
          if (this.isOnline) {
            // TODO: await supabaseHelper.submitFeedback(feedbackData);
            this.showMessage(this.t("Thank you for your feedback!"), "success");
          } else {
            this.showMessage(this.t("Feedback saved locally, will sync when online"), "warning");
          }
          
          newForm.reset();
        } catch (error) {
          console.error("Feedback submission failed:", error);
          this.showMessage(this.t("Failed to submit feedback. Please try again."), "error");
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
          <h3>${this.t("Idea Details")}</h3>
          <button onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <div class="loading">${this.t("Loading details...")}</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    try {
      // TODO: Call supabaseHelper.getIdeaDetails(ideaId)
      const result = { 
        restricted: true, 
        message: this.isOnline ? 
          this.t("Detailed view coming soon!") : 
          this.t("Detailed view requires internet connection")
      };

      const modalBody = modal.querySelector(".modal-body");

      if (result.restricted) {
        modalBody.innerHTML = `
          <div class="text-center">
            <p>${result.message || this.t("Detailed view is not available at this time.")}</p>
          </div>
        `;
      } else {
        const idea = result.data;
        modalBody.innerHTML = `
          <div class="idea-details">
            <h4>${this.t("Customer Profile")}</h4>
            <p>${this.escapeHtml(idea.ideal_customer_profile)}</p>
            
            <h4>${this.t("Product Idea")}</h4>
            <p>${this.escapeHtml(idea.product_idea)}</p>
            
            <h4>${this.t("Pain Points")}</h4>
            <p>${this.escapeHtml(idea.pain_points)}</p>
            
            <h4>${this.t("Alternatives")}</h4>
            <p>${this.escapeHtml(idea.alternatives)}</p>
            
            <div class="idea-meta">
              ${this.t("Categories")}: ${Array.isArray(idea.category) ? idea.category.join(", ") : idea.category || "None"} • 
              ${this.t("Quality Score")}: ${idea.quality_score}/100
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

  // Screen 2: My Submissions - Now with scroll frames for drafts
  async loadSubmissionsScreen() {
    const container = document.getElementById("submissions-list");
    if (!container) return;

    container.innerHTML = `<div class="loading">${this.t("Loading submissions...")}</div>`;

    const drafts = await dbHelper.getAllDrafts();

    if (drafts.length === 0) {
      container.innerHTML = `<div class="text-center">${this.t("No submissions yet")}</div>`;
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
                    <div class="drafts-scroll-frame">
                      ${projectDrafts.map(draft => this.renderSubmissionItem(draft, projectName)).join("")}
                    </div>
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
    const statusText = draft.is_final ? this.t("Final Submission") : `${this.t("Draft")} v${draft.version}`;
    const statusClass = draft.is_final ? "success" : "warning";
    const aiScore = draft.ai_feedback?.overall_score || draft.ai_feedback?.score;
    const syncStatus = draft.needs_sync ? " (offline)" : "";

    return `
      <div class="submission-item-compact">
        <div class="submission-meta-compact">
          <span class="status ${statusClass}">${statusText}${syncStatus}</span>
          <span class="submission-date">${new Date(draft.saved_at || draft.created_at).toLocaleDateString()}</span>
          ${aiScore ? `<span class="ai-score">AI: ${aiScore}/100</span>` : ""}
        </div>
        ${this.renderAIFeedback(draft.ai_feedback)}
      </div>
    `;
  }

  // Screen 3: Enhanced Submit Ideas with Dynamic Forms and Translation
  async loadSubmitScreen() {
    this.updateGreeting();
    this.setupSubmitForm();
    this.updateWordCounts();
    await this.setupUserSelectOptions();
    this.setupCategoryMultiSelect();
    await this.checkCooldownStatus();
    
    // Check for and restore auto-saved drafts
    setTimeout(() => this.restoreAutoSavedDraft(), 500);
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
      
      const translatedGreeting = this.translations?.ui[randomGreeting] || randomGreeting;
      greetingElement.textContent = translatedGreeting;
    }
  }

  async checkCooldownStatus() {
    if (!this.currentUser || !this.currentProject) return;

    const cooldownElement = document.getElementById("cooldown-message");
    const cooldownDaysElement = document.getElementById("cooldown-days");
    
    // Check last submission date from drafts
    try {
      const drafts = await dbHelper.getDraftsByUserAndProject(this.currentUser, this.currentProject);
      const finalSubmissions = drafts.filter(d => d.is_final);
      
      if (finalSubmissions.length > 0) {
        const lastSubmission = finalSubmissions.sort((a, b) => 
          new Date(b.created_at || b.saved_at) - new Date(a.created_at || a.saved_at)
        )[0];
        
        const daysSinceSubmission = Math.floor(
          (Date.now() - new Date(lastSubmission.created_at || lastSubmission.saved_at)) / (1000 * 60 * 60 * 24)
        );
        
        const cooldownDays = window.ENV.DRAFT_COOLDOWN_DAYS || 7;
        const showCooldown = daysSinceSubmission < cooldownDays;
        
        if (showCooldown) {
          const remainingDays = cooldownDays - daysSinceSubmission;
          cooldownElement.classList.remove("hidden");
          if (cooldownDaysElement) {
            cooldownDaysElement.textContent = remainingDays;
          }
          
          // Disable form submission
          const submitButton = document.getElementById("submit-button");
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = this.t("In Cooldown Period");
          }
          
          return;
        }
      }
    } catch (error) {
      console.error("Error checking cooldown:", error);
    }
    
    cooldownElement.classList.add("hidden");
    const submitButton = document.getElementById("submit-button");
    if (submitButton) {
      submitButton.disabled = false;
      this.updateSubmitButtonText();
    }
  }

  updateSubmitButtonText() {
    const submitButton = document.getElementById("submit-button");
    if (!submitButton || !this.currentUser || !this.currentProject) return;

    // Determine current draft number
    dbHelper.getDraftsByUserAndProject(this.currentUser, this.currentProject).then(existingDrafts => {
      const realDrafts = existingDrafts.filter(d => d.version > 0);
      const attemptNumber = realDrafts.length + 1;
      
      let buttonText;
      if (attemptNumber <= 2) {
        buttonText = `${this.t("Submit Draft")} ${attemptNumber}`;
      } else if (attemptNumber === 3) {
        buttonText = this.t("Submit Final Version");
      } else {
        buttonText = this.t("Maximum Reached");
        submitButton.disabled = true;
      }
      
      if (!this.isOnline) {
        buttonText += ` (${this.t("Offline")})`;
      }
      
      submitButton.textContent = buttonText;
    });
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

  async handleUserSelect(e) {
    const selectedValue = e.target.value;
    
    if (selectedValue === "new") {
      await this.showUserCreationForm();
    } else if (selectedValue) {
      await this.selectExistingUser(selectedValue);
    } else {
      this.currentUser = null;
      this.currentUserId = null;
      this.currentProject = null;
      this.projects = [];
      await this.setupProjectSelectOptions();
    }
    
    this.updateGreeting();
    await this.checkCooldownStatus();
    this.updateSubmitButtonText();
  }

  async handleProjectSelect(e) {
    if (e.target.value === "new") {
      await this.createNewProject();
    } else {
      this.currentProject = e.target.value;
    }
    await this.checkCooldownStatus();
    this.updateSubmitButtonText();
    
    // Try to restore auto-saved draft for this project
    setTimeout(() => this.restoreAutoSavedDraft(), 100);
  }

  // FIXED: Enhanced createNewProject method to ensure proper transaction handling
  async createNewProject() {
    const projectName = prompt(this.t("Enter project name:"));
    if (!projectName || !projectName.trim()) return;

    if (!this.currentUser) {
      this.showMessage(this.t("Please select a user first"), "error");
      return;
    }

    this.currentProject = projectName;

    try {
      this.projects.push({ 
        name: projectName, 
        user_id: this.currentUserId, 
        needs_sync: !this.isOnline 
      });

      await this.saveProjectsLocally(this.currentUserId, this.projects);

      // FIXED: Prepare the placeholder draft with all required fields BEFORE calling saveDraft
      // This ensures no async operations happen during the IndexedDB transaction
      const placeholderDraft = {
        device_id: dbHelper.getDeviceId(),
        full_name: this.currentUser,
        user_id: this.currentUserId,
        project_name: projectName,
        ideal_customer_profile: "",
        product_idea: "",
        pain_points: "",
        alternatives: "",
        category: [],
        heard_about: "",
        version: 0,
        is_final: false,
        needs_sync: !this.isOnline,
        saved_at: new Date().toISOString()
      };

      // FIXED: Call saveDraft with prepared data to prevent transaction timeout
      await dbHelper.saveDraft(placeholderDraft);
      await this.setupProjectSelectOptions();
      
      const projectSelect = document.getElementById("project-select");
      if (projectSelect) {
        projectSelect.value = projectName;
      }

      if (this.isOnline) {
        try {
          // TODO: Add supabaseHelper.createProject method when available
          const projectIndex = this.projects.findIndex(p => p.name === projectName);
          if (projectIndex !== -1) {
            this.projects[projectIndex].needs_sync = false;
            await this.saveProjectsLocally(this.currentUserId, this.projects);
          }
        } catch (error) {
          console.error("Failed to sync project to server:", error);
        }
      }

      this.showMessage(`${this.t("Project created")}: "${projectName}"!`, "success");
      this.updateSubmitButtonText();
    } catch (error) {
      console.error("Error creating project:", error);
      this.showMessage(this.t("Failed to create project"), "error");
      
      // Clean up on error
      this.projects = this.projects.filter(p => p.name !== projectName);
      if (this.currentProject === projectName) {
        this.currentProject = null;
      }
      await this.setupProjectSelectOptions();
    }
  }

  async setupProjectSelectOptions() {
    const projectSelect = document.getElementById("project-select");
    if (!projectSelect || !this.currentUser) return;

    if (this.currentUserId) {
      this.projects = await this.loadProjectsLocally(this.currentUserId);
    }

    if (this.isOnline && this.currentUserId) {
      try {
        // TODO: Add supabaseHelper.getProjectsByUserId method
      } catch (error) {
        console.error("Failed to load projects from server:", error);
      }
    }

    if (!this.projects.length) {
      const userDrafts = await dbHelper.getDraftsByUser(this.currentUser);
      const projectNames = [...new Set(userDrafts.map((d) => d.project_name || "Default Project"))];
      this.projects = projectNames.map(name => ({ 
        name, 
        user_id: this.currentUserId,
        needs_sync: false 
      }));
      
      if (this.currentUserId) {
        await this.saveProjectsLocally(this.currentUserId, this.projects);
      }
    }

    projectSelect.innerHTML = `
      <option value="">${this.t("Select Project")}</option>
      <option value="new">${this.t("Create New Project")}</option>
      ${this.projects.map(project => `
        <option value="${this.escapeHtml(project.name)}" ${project.name === this.currentProject ? "selected" : ""}>
          ${this.escapeHtml(project.name)}${project.needs_sync ? " (offline)" : ""}
        </option>
      `).join("")}
    `;
  }

  async saveProjectsLocally(userId, projects) {
    if (!userId) return;
    
    try {
      const key = `capsera_projects_${userId}`;
      const data = {
        projects: projects,
        updated_at: new Date().toISOString()
      };
      
      try {
        await dbHelper.saveSetting(key, data);
      } catch (error) {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (error) {
      console.error("Failed to save projects locally:", error);
    }
  }

  async loadProjectsLocally(userId) {
    if (!userId) return [];
    
    try {
      const key = `capsera_projects_${userId}`;
      
      try {
        const data = await dbHelper.getSetting(key);
        if (data && data.projects) {
          return data.projects;
        }
      } catch (error) {
        console.log("IndexedDB fallback failed, trying localStorage");
      }
      
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        return data.projects || [];
      }
    } catch (error) {
      console.error("Failed to load projects locally:", error);
    }
    
    return [];
  }

  async syncOfflineProjects() {
    if (!this.isOnline || !this.currentUserId) return;

    const unsynced = this.projects.filter(p => p.needs_sync);
    if (!unsynced.length) return;

    let syncedCount = 0;
    for (const project of unsynced) {
      try {
        // TODO: Call supabaseHelper.createProject when available
        project.needs_sync = false;
        syncedCount++;
      } catch (error) {
        console.error(`Failed to sync project "${project.name}":`, error);
      }
    }

    if (syncedCount > 0) {
      await this.saveProjectsLocally(this.currentUserId, this.projects);
      this.showMessage(`Synced ${syncedCount} projects to server`, "success");
      await this.setupProjectSelectOptions();
    }
  }

  async setupUserSelectOptions() {
    const userSelect = document.getElementById("user-select");
    if (!userSelect) return;

    const users = await dbHelper.getAllUsers();

    userSelect.innerHTML = `
      <option value="">${this.t("Select User")}</option>
      <option value="new">${this.t("Create New User")}</option>
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

        counter.innerHTML = `${count} <span data-ui-key="words">${this.t("words")}</span> (${min}-${max})`;
        counter.className = count > max ? "word-counter over-limit" : "word-counter";
      }
    });
  }

  async handleSubmission(e) {
    e.preventDefault();

    if (!this.currentUser) {
      this.showMessage(this.t("Please select or create a user first"), "error");
      return;
    }

    if (!this.currentProject) {
      this.showMessage(this.t("Please select or create a project"), "error");
      return;
    }

    const formData = new FormData(e.target);
    const categorySelect = document.getElementById("category");
    const selectedCategories = Array.from(categorySelect?.selectedOptions || []).map(option => option.value);

    const submission = {
      device_id: dbHelper.getDeviceId(),
      full_name: this.currentUser,
      user_id: this.currentUserId,
      project_name: this.currentProject,
      ideal_customer_profile: formData.get("ideal_customer_profile"),
      product_idea: formData.get("product_idea"),
      pain_points: formData.get("pain_points"),
      alternatives: formData.get("alternatives"),
      category: selectedCategories,
      heard_about: formData.get("heard_about"),
      market_validation: formData.get("market_validation"),
      competitor_research: formData.get("competitor_research"),
      mvp_development: formData.get("mvp_development"),
      investor_pitch: formData.get("investor_pitch"),
      additional_research: formData.get("additional_research"),
      mvp_link: formData.get("mvp_link"),
      needs_sync: !this.isOnline,
      saved_at: new Date().toISOString()
    };

    const validationResult = await validation.validateSubmission(submission, this.ideas);

    if (!validationResult.passed) {
      this.showMessage(validationResult.errors.join(", "), "error");
      return;
    }

    submission.quality_score = validationResult.qualityScore;

    const existingDrafts = await dbHelper.getDraftsByUserAndProject(this.currentUser, this.currentProject);
    const realDrafts = existingDrafts.filter((d) => d.version > 0);
    const attemptNumber = realDrafts.length + 1;
    submission.version = attemptNumber;

    try {
      const submitButton = document.getElementById("submit-button");
      const originalText = submitButton?.textContent;
      if (submitButton) {
        submitButton.textContent = this.t("Submitting...");
        submitButton.disabled = true;
      }

      if (attemptNumber <= 2) {
        if (attemptNumber === 1) {
          submission.first_draft_submitted_at = new Date().toISOString();
        }

        await dbHelper.saveDraft(submission);
        
        const statusMsg = this.isOnline ? 
          `${this.t("Draft")} ${attemptNumber} ${this.t("saved")}! AI feedback coming soon.` :
          `${this.t("Draft")} ${attemptNumber} ${this.t("saved locally")}! Will sync when online.`;
        
        this.showMessage(statusMsg, "success");
        
        // Clear auto-saved drafts for this project
        const autoSaved = existingDrafts.filter(d => d.auto_saved && d.version === 0);
        for (const draft of autoSaved) {
          await dbHelper.deleteDraft(draft.id);
        }
        
        this.clearForm();
        await this.checkCooldownStatus();
        
      } else if (attemptNumber === 3) {
        const confirmed = confirm(this.t("This is your final submission! Are you sure you're ready?"));
        
        if (!confirmed) {
          if (submitButton) {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
          }
          return;
        }

        submission.is_final = true;

        if (this.isOnline) {
          // TODO: await supabaseHelper.submitFinalIdea(submission);
          // TODO: await supabaseHelper.createOrGetUser(this.currentUser, dbHelper.getDeviceId());
        } else {
          await dbHelper.addToSyncQueue(submission);
        }

        await dbHelper.saveDraft(submission);
        
        const finalMsg = this.isOnline ?
          this.t("Idea submitted successfully! Thank you!") :
          this.t("Final submission saved locally! Will sync when online.");
          
        this.showMessage(finalMsg, "success");
        this.clearForm();
        
      } else {
        this.showMessage(this.t("Maximum submissions reached for this project."), "error");
      }
    } catch (error) {
      console.error("Submission error:", error);
      this.showMessage(`${this.t("Submission failed")}: ${error.message}`, "error");
    } finally {
      const submitButton = document.getElementById("submit-button");
      if (submitButton && originalText) {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }
    }
  }

  // Enhanced AI Feedback Rendering with Translation
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
          <span class="ai-badge">${this.t("AI Analysis")}</span>
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
          <span class="ai-badge">${this.t("AI Feedback")}</span>
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

  // Screen 4: Settings with Enhanced Translation Support
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
            <p>${this.t("Updating language...")}</p>
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
        this.showMessage(this.t("Language updated successfully"), "success");
      }
    } catch (error) {
      console.error("Language update failed:", error);
      this.showMessage(this.t("Failed to update language"), "error");
    } finally {
      loadingOverlay.remove();
    }
  }

  async loadUsersList() {
    const container = document.getElementById("users-list");
    if (!container) return;

    try {
      const localUsers = await dbHelper.getAllUsers();
      const allUsers = localUsers;

      if (allUsers.length === 0) {
        container.innerHTML = `<div class="text-center">${this.t("No users found")}</div>`;
        return;
      }

      const html = allUsers.map(user => `
        <div class="user-item">
          <span>${this.escapeHtml(user.full_name)}</span>
          <button class="btn btn-danger btn-sm" onclick="app.deleteUser('${user.full_name}')">
            ${this.t("Delete")}
          </button>
        </div>
      `).join("");

      container.innerHTML = html;
    } catch (error) {
      console.error("Error loading users:", error);
      container.innerHTML = '<div class="error">Failed to load users</div>';
    }
  }

  // Enhanced offline data sync with better error handling
  async syncOfflineData() {
    if (!this.isOnline) return;

    try {
      const queue = await dbHelper.getSyncQueue();
      let syncedCount = 0;
      let failedCount = 0;

      for (const item of queue) {
        try {
          // TODO: Implement actual server sync based on item type
          // if (item.type === 'draft') {
          //   await supabaseHelper.submitFinalIdea(item.data);
          // } else if (item.type === 'feedback') {
          //   await supabaseHelper.submitFeedback(item.data);
          // }
          
          await dbHelper.removeFromSyncQueue(item.key);
          syncedCount++;
        } catch (error) {
          console.error("Sync failed for item:", item.key, error);
          failedCount++;
        }
      }

      if (syncedCount > 0) {
        this.showMessage(`Synced ${syncedCount} items${failedCount > 0 ? `, ${failedCount} failed` : ''}`, 
          failedCount > 0 ? "warning" : "success");
      }

      // Sync projects
      await this.syncOfflineProjects();
      
      // Sync drafts that need syncing
      await this.syncOfflineDrafts();
      
    } catch (error) {
      console.error("Sync operation failed:", error);
      this.showMessage(this.t("Sync failed. Will retry later."), "error");
    }
  }

  async syncOfflineDrafts() {
    try {
      const allDrafts = await dbHelper.getAllDrafts();
      const unsyncedDrafts = allDrafts.filter(d => d.needs_sync);
      
      let syncedCount = 0;
      for (const draft of unsyncedDrafts) {
        try {
          if (draft.is_final) {
            // TODO: await supabaseHelper.submitFinalIdea(draft);
          }
          // TODO: Mark draft as synced in database
          // await dbHelper.markDraftAsSynced(draft.id);
          syncedCount++;
        } catch (error) {
          console.error(`Failed to sync draft ${draft.id}:`, error);
        }
      }
      
      if (syncedCount > 0) {
        console.log(`Synced ${syncedCount} drafts`);
      }
    } catch (error) {
      console.error("Failed to sync drafts:", error);
    }
  }

  // Utility methods with translation support
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
      form.querySelectorAll(".auto-expand").forEach(textarea => {
        textarea.style.height = "auto";
        this.autoExpandTextarea(textarea);
      });
      this.updateWordCounts();
    }
    this.currentProject = null;
  }

  async deleteUser(fullName) {
    const pin = prompt(this.t("Enter your 4-digit PIN:"));
    if (!pin || pin.length !== 4) return;

    const localUser = await dbHelper.getUser(fullName);
    if (!localUser || dbHelper.hashPin(pin) !== localUser.pin_hash) {
      this.showMessage(this.t("Invalid PIN"), "error");
      return;
    }

    try {
      await dbHelper.deleteUser(fullName);
      this.showMessage(this.t("User deleted"), "success");
      await this.loadUsersList();
    } catch (error) {
      console.error("Delete user error:", error);
      this.showMessage(this.t("Failed to delete user"), "error");
    }
  }

  async showUserCreationForm() {
    const name = prompt(this.t("What's your full name?"));
    if (!name) return;

    const pin = prompt(this.t("Create a 4-digit PIN:"));
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      this.showMessage(this.t("PIN must be exactly 4 digits"), "error");
      return;
    }

    try {
      const pinHash = dbHelper.hashPin(pin);
      const userData = await dbHelper.saveUser(name, pinHash);

      this.currentUser = name;
      this.currentUserId = userData.id;
      this.projects = [];
      
      if (this.isOnline) {
        try {
          // TODO: Call supabaseHelper.createOrGetUser when implementation is available
          // const serverUser = await supabaseHelper.createOrGetUser(name, dbHelper.getDeviceId());
          // this.currentUserId = serverUser.id;
          // await dbHelper.saveUser(name, pinHash, serverUser.id);
        } catch (error) {
          console.error("Failed to create user on server:", error);
        }
      }

      await this.setupUserSelectOptions();
      await this.setupProjectSelectOptions();
      this.updateGreeting();
      this.showMessage(`${this.t("User created")}: ${name}!`, "success");
      this.updateSubmitButtonText();
    } catch (error) {
      console.error("User creation error:", error);
      this.showMessage(this.t("Failed to create user"), "error");
    }
  }

  async selectExistingUser(fullName) {
    const pin = prompt(this.t("Enter your PIN:"));
    if (!pin) {
      this.resetUserDropdownToPrevious();
      return;
    }

    const localUser = await dbHelper.getUser(fullName);
    if (!localUser || dbHelper.hashPin(pin) !== localUser.pin_hash) {
      this.showMessage(this.t("Invalid PIN"), "error");
      this.resetUserDropdownToPrevious();
      return;
    }

    this.currentUser = fullName;
    this.currentUserId = localUser.user_uuid || localUser.id;
    this.currentProject = null;
    this.projects = [];
    
    await this.setupProjectSelectOptions();
    this.showMessage(`${this.t("Welcome back")}, ${fullName}!`, "success");
    this.updateSubmitButtonText();
  }

  resetUserDropdownToPrevious() {
    const userSelect = document.getElementById("user-select");
    if (!userSelect) return;

    userSelect.value = this.currentUser || "";
    
    const projectSelect = document.getElementById("project-select");
    if (projectSelect) {
      projectSelect.innerHTML = `<option value="">${this.t("Select Project")}</option>`;
      this.currentProject = null;
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.app = new CapseraApp();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideDown {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  .drafts-scroll-frame {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--capsera-border, #ddd);
    border-radius: 4px;
    padding: 10px;
    background: #f9f9f9;
  }
  
  .submission-details {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
  }
  
  .submission-details.expanded {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .offline-banner {
    z-index: 1002 !important;
  }
  
  .offline-content {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
  }
  
  .offline-dismiss {
    background: none;
    border: none;
    color: #212529;
    font-size: 18px;
    cursor: pointer;
    padding: 0 5px;
  }
  
  .offline-dismiss:hover {
    background: rgba(0,0,0,0.1);
    border-radius: 50%;
  }
`;
document.head.appendChild(style);
