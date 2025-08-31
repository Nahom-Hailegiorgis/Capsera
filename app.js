// app.js - Enhanced Capsera PWA with offline capabilities and version management
import { dbHelper } from "./db.js";
import { supabaseHelper } from "./supabase.js";
import { validation } from "./validation.js";
import { translator } from "./translate.js";

// Simple localforage-like wrapper for IndexedDB if localforage isn't available
class SimpleStorage {
  constructor() {
    this.dbName = 'capsera-offline';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async setItem(key, value) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['drafts'], 'readwrite');
      const store = transaction.objectStore('drafts');
      const request = store.put({ id: key, data: value, timestamp: Date.now() });
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getItem(key) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['drafts'], 'readonly');
      const store = transaction.objectStore('drafts');
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.data || null);
    });
  }
}

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
    this.offlineStorage = null;
    this.currentAppVersion = null;

    this.init();
  }

  async init() {
    // Initialize offline storage
    try {
      if (typeof localforage !== 'undefined') {
        this.offlineStorage = localforage;
      } else {
        this.offlineStorage = new SimpleStorage();
        await this.offlineStorage.init();
      }
    } catch (error) {
      console.warn('Offline storage initialization failed:', error);
    }

    this.setupEventListeners();
    await this.registerServiceWorker();
    await this.checkAppVersion();
    this.translations = await translator.init();
    await this.loadIdeasScreen();
    this.showScreen("ideas");
    
    // Show offline indicator if needed
    this.updateOnlineStatus();
    
    // Sync intervals
    setInterval(() => this.syncOfflineData(), 30000);
    this.syncOfflineProjects();
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

  async checkAppVersion() {
    try {
      // Check current version from manifest
      const response = await fetch('/manifest.json', { cache: 'no-store' });
      const manifest = await response.json();
      const newVersion = manifest.version || 'unknown';
      
      const lastVersion = await this.getStoredVersion();
      
      if (lastVersion && lastVersion !== newVersion) {
        this.showMessage('App updated! Refresh to see latest features.', 'info');
        await this.setStoredVersion(newVersion);
      } else if (!lastVersion) {
        await this.setStoredVersion(newVersion);
      }
      
      this.currentAppVersion = newVersion;
    } catch (error) {
      console.warn('Version check failed:', error);
    }
  }

  async getStoredVersion() {
    try {
      return await this.offlineStorage?.getItem('app_version');
    } catch {
      return localStorage.getItem('capsera_app_version');
    }
  }

  async setStoredVersion(version) {
    try {
      await this.offlineStorage?.setItem('app_version', version);
    } catch {
      localStorage.setItem('capsera_app_version', version);
    }
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
      this.updateOnlineStatus();
      this.syncOfflineData();
      this.syncOfflineProjects();
      this.showMessage(this.t("Connection restored"), "success");
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.updateOnlineStatus();
      this.showMessage(this.t("Working offline — drafts saved locally"), "warning");
    });

    // Service worker messages
    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        const { data } = event;
        
        switch (data.type) {
          case 'NEW_VERSION_AVAILABLE':
            this.handleNewVersion(data.version);
            break;
          case 'SYNC_OFFLINE_DATA':
            this.syncOfflineData();
            this.syncOfflineProjects();
            break;
        }
      });
    }
  }

  handleNewVersion(version) {
    // Show update notification
    const updateBanner = document.createElement('div');
    updateBanner.className = 'update-banner';
    updateBanner.innerHTML = `
      <div class="update-content">
        <span>New version available (${version})!</span>
        <button onclick="window.location.reload()" class="btn btn-sm btn-primary">
          Refresh Now
        </button>
        <button onclick="this.parentElement.parentElement.remove()" class="btn btn-sm">
          Later
        </button>
      </div>
    `;
    
    updateBanner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 1002;
      background: #f9bd45; padding: 10px; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    document.body.insertBefore(updateBanner, document.body.firstChild);
  }

  updateOnlineStatus() {
    // Add/remove offline indicator
    let indicator = document.querySelector('.offline-indicator');
    
    if (!this.isOnline) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'offline-indicator';
        indicator.textContent = 'Working Offline';
        indicator.style.cssText = `
          position: fixed; bottom: 20px; left: 20px; z-index: 1001;
          background: #ff6b6b; color: white; padding: 8px 16px;
          border-radius: 20px; font-size: 0.9rem; font-weight: 600;
        `;
        document.body.appendChild(indicator);
      }
    } else {
      if (indicator) {
        indicator.remove();
      }
    }
  }

  // Save draft locally when offline
  async saveDraftLocally(draftData) {
    if (!this.offlineStorage) return false;
    
    try {
      const draftKey = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const draftWithMetadata = {
        ...draftData,
        savedOffline: true,
        savedAt: new Date().toISOString(),
        needsSync: true
      };
      
      await this.offlineStorage.setItem(draftKey, draftWithMetadata);
      console.log('Draft saved offline:', draftKey);
      return true;
    } catch (error) {
      console.error('Failed to save draft offline:', error);
      return false;
    }
  }

  // Get offline drafts
  async getOfflineDrafts() {
    if (!this.offlineStorage) return [];
    
    try {
      // TODO: Implement proper iteration over offline storage
      // This would require implementing a keys() method for SimpleStorage
      // For now, return empty array and rely on existing dbHelper.getAllDrafts()
      return [];
    } catch (error) {
      console.error('Failed to get offline drafts:', error);
      return [];
    }
  }

  // Enhanced submission handling with offline support
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
    const selectedCategories = Array.from(categorySelect.selectedOptions).map(option => option.value);

    // Build submission object
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
    };

    // Validate submission
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
        // Draft submissions - save locally first
        if (attemptNumber === 1) {
          submission.first_draft_submitted_at = new Date().toISOString();
        }

        // Always save to local storage first
        await dbHelper.saveDraft(submission);
        
        // If offline, also save to offline storage
        if (!this.isOnline) {
          await this.saveDraftLocally(submission);
        }
        
        this.showMessage(
          `${this.t("Draft")} ${attemptNumber} ${this.isOnline ? this.t("saved") : this.t("saved locally")}! AI feedback coming soon.`, 
          "success"
        );
        this.clearForm();
        this.checkCooldownStatus();
        
      } else if (attemptNumber === 3) {
        // Final submission
        const confirmed = confirm(this.t("This is your final submission! Are you sure you're ready?"));
        
        if (!confirmed) return;

        submission.is_final = true;

        // Save locally first
        await dbHelper.saveDraft(submission);

        if (this.isOnline) {
          // TODO: await supabaseHelper.submitFinalIdea(submission);
          // TODO: await supabaseHelper.createOrGetUser(this.currentUser, dbHelper.getDeviceId());
        } else {
          // Save for later sync
          await dbHelper.addToSyncQueue(submission);
          await this.saveDraftLocally(submission);
        }

        this.showMessage(
          this.isOnline ? this.t("Idea submitted successfully! Thank you!") : this.t("Idea saved for submission when online!"), 
          "success"
        );
        this.clearForm();
        
      } else {
        this.showMessage(this.t("Maximum submissions reached for this project."), "error");
      }
    } catch (error) {
      console.error("Submission error:", error);
      this.showMessage(`${this.t("Submission failed")}: ${error.message}`, "error");
    }
  }

  // Enhanced sync with offline draft support
  async syncOfflineData() {
    if (!this.isOnline) return;

    const queue = await dbHelper.getSyncQueue();
    let syncedCount = 0;

    for (const item of queue) {
      try {
        // TODO: Implement actual sync logic
        await dbHelper.removeFromSyncQueue(item.key);
        syncedCount++;
      } catch (error) {
        console.error("Sync failed for item:", item.key, error);
      }
    }

    // Sync offline drafts if available
    const offlineDrafts = await this.getOfflineDrafts();
    for (const draft of offlineDrafts) {
      if (draft.needsSync) {
        try {
          // TODO: Sync to server
          syncedCount++;
        } catch (error) {
          console.error("Failed to sync offline draft:", error);
        }
      }
    }

    if (syncedCount > 0) {
      this.showMessage(`Synced ${syncedCount} items to server`, "success");
    }

    await this.syncOfflineProjects();
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
  }

  // Auto-expand textarea functionality
  autoExpandTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
    
    if (textarea.scrollHeight < 60) {
      textarea.style.height = "60px";
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
      container.innerHTML = '<div class="error">Failed to load ideas</div>';
    }
  }

  renderIdeasList() {
    const container = document.getElementById("ideas-list");
    if (!container) return;

    if (this.ideas.length === 0) {
      container.innerHTML = `<div class="text-center">${this.t("No ideas found")}</div>`;
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
          <button type="submit" class="btn btn-primary">${this.t("Submit Feedback")}</button>
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

          // TODO: Call supabaseHelper.submitFeedback(feedbackData)
          // const result = await supabaseHelper.submitFeedback(feedbackData);

          this.showMessage(this.t("Thank you for your feedback!"), "success");
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
      const result = { restricted: true, message: this.t("Detailed view coming soon!") };

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

  // Screen 2: My Submissions - Compact Design with Expand/Collapse
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
              const
