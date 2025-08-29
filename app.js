// NEW app.js - Enhanced with compact submission cards, draft sidebar, and conversational tone 
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
      this.showMessage("Connection restored!", "success");
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.showMessage("Working offline - no worries!", "warning");
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
      const newTextarea = textarea.cloneNode(true);
      textarea.parentNode.replaceChild(newTextarea, textarea);

      // Add autosize functionality
      const handleInput = (e) => {
        const target = e.target;
        target.style.height = "auto";
        target.style.height = Math.max(60, target.scrollHeight) + "px";
      };

      newTextarea.addEventListener("input", handleInput);
      newTextarea.addEventListener("change", handleInput);

      // Initial size adjustment
      newTextarea.style.height = "auto";
      newTextarea.style.height = Math.max(60, newTextarea.scrollHeight) + "px";
    });
  }

  // Enhanced card toggle functionality
  setupSubmissionCardToggles() {
    const cards = document.querySelectorAll(".submission-card");

    cards.forEach((card) => {
      const chevron = card.querySelector(".submission-card-chevron");
      const header = card.querySelector(".submission-card-header");

      if (!chevron || !header) return;

      // Remove existing listeners by cloning elements
      const newChevron = chevron.cloneNode(true);
      chevron.parentNode.replaceChild(newChevron, chevron);

      const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isExpanded = card.classList.contains("submission-card--expanded");

        if (isExpanded) {
          card.classList.remove("submission-card--expanded");
          newChevron.setAttribute("aria-expanded", "false");
          newChevron.style.transform = "rotate(0deg)";
        } else {
          card.classList.add("submission-card--expanded");
          newChevron.setAttribute("aria-expanded", "true");
          newChevron.style.transform = "rotate(180deg)";
        }
      };

      newChevron.addEventListener("click", handleToggle);
      header.addEventListener("click", handleToggle);
    });
  }

  // Draft sidebar functionality
  setupDraftSidebar() {
    const openButtons = document.querySelectorAll('.open-draft-sidebar');
    const sidebar = document.getElementById('draft-sidebar');
    const closeButton = document.querySelector('.draft-sidebar-close');
    const overlay = document.querySelector('.sidebar-overlay');

    openButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        const user = e.target.getAttribute('data-user');
        const project = e.target.getAttribute('data-project');
        await this.openDraftSidebar(user, project);
      });
    });

    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.closeDraftSidebar();
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        this.closeDraftSidebar();
      });
    }
  }

  async openDraftSidebar(user, project) {
    const sidebar = document.getElementById('draft-sidebar');
    const overlay = document.querySelector('.sidebar-overlay') || this.createSidebarOverlay();
    
    if (!sidebar) return;

    // Load drafts for this user/project
    const drafts = await dbHelper.getDraftsByUserAndProject(user, project);
    const filteredDrafts = drafts.filter(d => d.version > 0 && !this.isDraftPlaceholder(d));

    const content = document.querySelector('.draft-sidebar-content');
    if (!content) return;

    if (filteredDrafts.length === 0) {
      content.innerHTML = `
        <div class="text-center" style="padding: 2rem; color: #666;">
          No previous drafts found for this project.
        </div>
      `;
    } else {
      const draftsHtml = filteredDrafts.map((draft, index) => `
        <div class="draft-item" onclick="app.loadDraftIntoForm(${JSON.stringify(draft).replace(/"/g, '&quot;')})">
          <div class="draft-item-header">
            <span class="draft-version">Draft ${draft.version}</span>
            <span class="draft-date">${new Date(draft.created_at).toLocaleDateString()}</span>
          </div>
          <div class="draft-preview">
            ${this.escapeHtml((draft.product_idea || '').substring(0, 100))}${(draft.product_idea || '').length > 100 ? '...' : ''}
          </div>
        </div>
      `).join('');

      content.innerHTML = draftsHtml;
    }

    sidebar.classList.add('open');
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  closeDraftSidebar() {
    const sidebar = document.getElementById('draft-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  createSidebarOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999;
      display: none;
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  loadDraftIntoForm(draft) {
    // Fill form fields with draft data
    const fields = {
      'ideal_customer_profile': draft.ideal_customer_profile || '',
      'product_idea': draft.product_idea || '',
      'pain_points': draft.pain_points || '',
      'alternatives': draft.alternatives || '',
      'heard_about': draft.heard_about || ''
    };

    Object.entries(fields).forEach(([fieldId, value]) => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.value = value;
        // Trigger autosize for textareas
        if (field.tagName === 'TEXTAREA') {
          field.style.height = 'auto';
          field.style.height = Math.max(60, field.scrollHeight) + 'px';
        }
      }
    });

    // Handle categories (multi-select)
    const categorySelect = document.getElementById('category');
    if (categorySelect && draft.category) {
      const categories = Array.isArray(draft.category) ? draft.category : [draft.category];
      Array.from(categorySelect.options).forEach(option => {
        option.selected = categories.includes(option.value);
      });
    }

    this.closeDraftSidebar();
    this.showMessage("Draft loaded! Make your changes and submit.", "success");
  }

  // Check if draft is a placeholder (auto-generated empty draft)
  isDraftPlaceholder(draft) {
    const fields = [
      draft.ideal_customer_profile,
      draft.product_idea,
      draft.pain_points,
      draft.alternatives
    ];
    
    const hasContent = fields.some(field => field && field.trim().length > 0);
    const hasNotSpecifiedContent = fields.some(field => 
      field && field.includes('Not specified')
    );
    
    return !hasContent || hasNotSpecifiedContent;
  }

  // Enhanced submission handling with conversational messaging
  async handleSubmission(e) {
    e.preventDefault();

    console.log("🔧 DEBUG: Starting submission process");

    if (!this.currentUser) {
      this.showMessage("Hey! Please pick a user or create one first 😊", "error");
      return;
    }

    if (!this.currentProject) {
      this.showMessage("Don't forget to select or create a project!", "error");
      return;
    }

    const formData = new FormData(e.target);

    // Get field values with compatibility layer
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

    // Get selected categories
    const categorySelect = document.getElementById("category");
    const selectedCategories = Array.from(categorySelect.selectedOptions).map(
      (option) => option.value
    );

    const submission = {
      device_id: dbHelper.getDeviceId(),
      full_name: this.currentUser,
      project_name: this.currentProject,
      ideal_customer_profile: getFieldValue("customer_profile", "ideal_customer_profile"),
      product_idea: getFieldValue("main_idea", "product_idea"),
      pain_points: getFieldValue("problems_solved", "pain_points"),
      alternatives: getFieldValue("competitive_landscape", "alternatives"),
      category: selectedCategories,
      heard_about: getFieldValue("discovery_source", "heard_about"),
    };

    console.log("🔧 DEBUG: Submission data:", submission);

    // Validate submission
    const validationResult = await validation.validateSubmission(submission, this.ideas);

    if (!validationResult.passed) {
      this.showMessage(`Oops! ${validationResult.errors.join(", ")}`, "error");
      return;
    }

    submission.quality_score = validationResult.qualityScore;

    // Determine attempt number
    const existingDrafts = await dbHelper.getDraftsByUserAndProject(
      this.currentUser,
      this.currentProject
    );

    const realDrafts = existingDrafts.filter((d) => d.version > 0 && !this.isDraftPlaceholder(d));
    const attemptNumber = realDrafts.length + 1;
    submission.version = attemptNumber;

    console.log("🔧 DEBUG: Attempt number:", attemptNumber, "Real drafts found:", realDrafts.length);

    try {
      if (attemptNumber <= 2) {
        console.log("🔧 DEBUG: Processing draft submission (attempt", attemptNumber, ")");

        const aiFeedback = await supabaseHelper.getAIFeedback(submission);
        submission.ai_feedback = aiFeedback;

        if (aiFeedback.overall_score) {
          submission.quality_score = aiFeedback.overall_score;
        }

        await dbHelper.saveDraft(submission);

        const userName = this.currentUser;
        const greeting = translator.getGreeting(userName);
        
        this.showMessage(
          `${greeting} Draft ${attemptNumber} saved successfully! Check out the AI feedback below.`,
          "success"
        );
        this.showAIFeedbackModal(aiFeedback);
        this.clearForm();
      } else if (attemptNumber === 3) {
        console.log("🔧 DEBUG: Processing final submission (attempt 3)");

        const confirmed = confirm(
          "🚀 FINAL SUBMISSION TIME! 🚀\n\nThis is your 3rd and final submission for this project. After submitting:\n• No more changes allowed\n• Your idea gets saved permanently\n• That's it for this project!\n\nReady to make it count?"
        );

        if (!confirmed) {
          console.log("🔧 DEBUG: Final submission cancelled by user");
          return;
        }

        const aiFeedback = await supabaseHelper.getAIFeedback(submission);
        submission.ai_feedback = aiFeedback;
        submission.is_final = true;

        if (aiFeedback.overall_score) {
          submission.quality_score = aiFeedback.overall_score;
        }

        if (this.isOnline) {
          console.log("🔧 DEBUG: Submitting final idea to Supabase");

          try {
            await supabaseHelper.submitFinalIdea(submission);
            await supabaseHelper.createUser(this.currentUser);

            console.log("🔧 DEBUG: Final idea submitted successfully to Supabase");
          } catch (supabaseError) {
            console.error("🔧 DEBUG: Supabase submission failed:", supabaseError);
            throw supabaseError;
          }

          await dbHelper.saveDraft(submission);

          const userName = this.currentUser;
          const greeting = translator.getGreeting(userName);
          
          this.showMessage(
            `🎉 ${greeting} Your idea is now live on Capsera! Thanks for sharing your brilliance with us!`,
            "success"
          );
          this.showAIFeedbackModal(aiFeedback);
          this.clearForm();
        } else {
          console.log("🔧 DEBUG: Offline - queuing final submission");

          await dbHelper.saveDraft(submission);
          await dbHelper.addToSyncQueue(submission);
          this.showMessage("No worries! We'll submit this when you're back online.", "warning");
        }
      } else {
        console.log("🔧 DEBUG: Too many attempts for project:", this.currentProject);
        this.showMessage(
          "Looks like you've hit the 3-submission limit for this project. Time to start a fresh one!",
          "error"
        );
      }
    } catch (error) {
      console.error("🔧 DEBUG: Submission error:", error);
      this.showMessage(
        `Oops! Something went wrong: ${error.message}. Mind giving it another shot?`,
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
      container.innerHTML = '<div class="error">Oops! Couldn\'t load ideas right now.</div>';
    }
  }

  renderIdeasList() {
    const container = document.getElementById("ideas-list");
    if (!container) return;

    if (this.ideas.length === 0) {
      container.innerHTML = '<div class="text-center">No ideas found yet. Be the first!</div>';
      return;
    }

    const html = this.ideas
      .map(
        (idea) => `
      <div class="idea-item" onclick="app.viewIdeaDetails('${idea.id}')">
        <div class="idea-title">${this.escapeHtml(
          idea.preview || "Cool Idea"
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
        <h3 data-ui-key="Share Your Thoughts">Share Your Thoughts</h3>
        <form id="feedback-form" class="feedback-form">
          <div class="form-group">
            <label class="form-label" data-ui-key="How can we make Capsera even better?">How can we make Capsera even better?</label>
            <textarea id="feedback-message" class="form-textarea" 
                     placeholder="Tell us what you think..." required data-ui-key="Tell us what you think..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" data-ui-key="Contact (Optional)">Contact (Optional)</label>
            <input type="text" id="feedback-contact" class="form-input" 
                   placeholder="Email or phone (optional)" data-ui-key="Email or phone (optional)">
          </div>
          <button type="submit" class="btn btn-primary" data-ui-key="Send Feedback">Send Feedback</button>
        </form>
      </div>
    `;
  }

  setupFeedbackForm() {
    console.log("🔧 FEEDBACK: Setting up feedback form");

    const trySetupForm = () => {
      const form = document.getElementById("feedback-form");
      if (!form) {
        console.error("🔧 FEEDBACK: Form element not found!");
        return false;
      }

      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);
      console.log("🔧 FEEDBACK: Form listener attached successfully");

      newForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("🔧 FEEDBACK: Form submission started");

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
          this.showMessage("We'd love to hear your thoughts! Please share your feedback.", "error");
          return;
        }

        const originalText = submitButton?.textContent || "Send Feedback";
        if (submitButton) {
          submitButton.textContent = "Sending...";
          submitButton.disabled = true;
        }

        try {
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

          const result = await supabaseHelper.submitFeedback(feedbackData);

          console.log("🔧 FEEDBACK: Success!", {
            id: result.id,
            created_at: result.created_at,
          });

          this.showMessage("Thanks for the feedback! We really appreciate it 😊", "success");
          newForm.reset();
        } catch (error) {
          console.error("🔧 FEEDBACK: Failed:", error);

          let errorMessage = "Oops! Couldn't submit feedback. Please try again.";
          if (error.message.includes("policy")) {
            errorMessage = "Permission error - please contact support.";
          } else if (error.message.includes("network")) {
            errorMessage = "Network error - check your connection.";
          }

          this.showMessage(errorMessage, "error");
        } finally {
          if (submitButton) {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
          }
        }
      });

      return true;
    };

    if (trySetupForm()) {
      return;
    }

    setTimeout(() => {
      if (!trySetupForm()) {
        setTimeout(() => {
          trySetupForm();
        }, 100);
      }
    }, 10);
  }

  // Screen 2: Enhanced My Submissions with Compact Cards
  async loadSubmissionsScreen() {
    const container = document.getElementById("submissions-list");
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading your submissions...</div>';

    try {
      const submissions = await dbHelper.getAllDrafts();
      
      // Filter out placeholder drafts and group by user
      const validSubmissions = submissions.filter(s => !this.isDraftPlaceholder(s));
      
      const grouped = this.groupSubmissionsByUser(validSubmissions);
      this.renderSubmissionsWithCompactCards(grouped);
      this.setupSubmissionCardToggles();
      this.setupDraftSidebar();
      this.setupTextareaAutosize();
    } catch (error) {
      console.error("Error loading submissions:", error);
      container.innerHTML = '<div class="error">Oops! Couldn\'t load your submissions.</div>';
    }
  }

  groupSubmissionsByUser(submissions) {
    const grouped = {};
    
    submissions.forEach(submission => {
      const user = submission.full_name;
      if (!grouped[user]) {
        grouped[user] = {};
      }
      
      const project = submission.project_name;
      if (!grouped[user][project]) {
        grouped[user][project] = [];
      }
      
      grouped[user][project].push(submission);
    });

    // Sort submissions within each project by version
    Object.keys(grouped).forEach(user => {
      Object.keys(grouped[user]).forEach(project => {
        grouped[user][project].sort((a, b) => (b.version || 0) - (a.version || 0));
      });
    });

    return grouped;
  }

  renderSubmissionsWithCompactCards(grouped) {
    const container = document.getElementById("submissions-list");
    if (!container) return;

    if (Object.keys(grouped).length === 0) {
      container.innerHTML = `
        <div class="text-center" style="padding: 3rem;">
          <div style="font-size: 1.2rem; color: #666; margin-bottom: 1rem;">No submissions yet!</div>
          <div>Ready to share your first brilliant idea? 
            <a href="#" onclick="app.showScreen('submit')" style="color: var(--capsera-accent); text-decoration: none; font-weight: 600;">Get started here!</a>
          </div>
        </div>
      `;
      return;
    }

    const html = Object.entries(grouped).map(([user, projects]) => `
      <div class="user-section">
        <h3 class="user-header">
          ${translator.getGreeting(user)}
        </h3>
        
        <div class="projects-overview">
          <h4 data-ui-key="Projects Summary">Projects Summary</h4>
          ${Object.entries(projects).map(([project, submissions]) => {
            const latest = submissions[0];
            const totalAttempts = submissions.length;
            const isFinal = latest.is_final || latest.version >= 3;
            
            return `
              <div class="project-overview">
                <div class="project-header">
                  <strong>${this.escapeHtml(project)}</strong>
                  <div>
                    <span class="status ${isFinal ? 'success' : 'warning'}">
                      ${isFinal ? 'Final Submission' : `Draft ${latest.version || 1}`}
                    </span>
                    ${totalAttempts > 1 && latest.version < 3 ? 
                      `<button class="btn btn-sm open-draft-sidebar" data-user="${user}" data-project="${project}" style="margin-left: 0.5rem;">
                        View Drafts (${totalAttempts})
                      </button>` : 
                      ''
                    }
                  </div>
                </div>
                <div class="project-meta">
                  ${totalAttempts} ${totalAttempts === 1 ? 'attempt' : 'attempts'} • 
                  Last updated: ${new Date(latest.updated_at || latest.created_at).toLocaleDateString()}
                </div>
                <div class="project-preview">
                  ${this.escapeHtml((latest.product_idea || '').substring(0, 150))}${(latest.product_idea || '').length > 150 ? '...' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="user-submissions">
          <h4 data-ui-key="All Submissions">All Submissions</h4>
          ${Object.entries(projects).map(([project, submissions]) => 
            submissions.map(submission => this.renderCompactSubmissionCard(submission)).join('')
          ).join('')}
        </div>
      </div>
    `).join('');

    container.innerHTML = html + this.getDraftSidebarHTML();
  }

  renderCompactSubmissionCard(submission) {
    const isExpanded = false; // Start collapsed
    const userName = submission.full_name;
    const attemptText = submission.version > 1 ? ` (Attempt ${submission.version})` : '';
    
    return `
      <div class="submission-card ${isExpanded ? 'submission-card--expanded' : ''}">
        <div class="submission-card-header">
          <div class="submission-card-title">
            <div class="submission-card-main-title">
              ${this.escapeHtml(submission.project_name)}${attemptText}
            </div>
            <div class="submission-card-meta">
              <span>${new Date(submission.created_at).toLocaleDateString()}</span>
              <span>•</span>
              <span class="status ${submission.is_final ? 'success' : 'warning'}">
                ${submission.is_final ? 'Final' : 'Draft'}
              </span>
              ${submission.quality_score ? `<span>• Score: ${submission.quality_score}/100</span>` : ''}
            </div>
          </div>
          <div class="submission-card-chevron" aria-expanded="${isExpanded}" role="button" tabindex="0">
            ▼
          </div>
        </div>
        
        <div class="submission-card-content">
          <div class="submission-card-body">
            <div style="display: grid; gap: 1.5rem;">
              
              <div class="submission-field">
                <h4 data-ui-key="Who's This For?">Who's This For?</h4>
                <p>${this.escapeHtml(submission.ideal_customer_profile || 'Not specified')}</p>
              </div>

              <div class="submission-field">
                <h4 data-ui-key="The Big Idea">The Big Idea</h4>
                <p>${this.escapeHtml(submission.product_idea || 'Not specified')}</p>
              </div>

              <div class="submission-field">
                <h4 data-ui-key="Problems It Solves">Problems It Solves</h4>
                <p>${this.escapeHtml(submission.pain_points || 'Not specified')}</p>
              </div>

              <div class="submission-field">
                <h4 data-ui-key="What's Out There Already">What's Out There Already</h4>
                <p>${this.escapeHtml(submission.alternatives || 'Not specified')}</p>
              </div>

              ${submission.category && submission.category.length > 0 ? `
              <div class="submission-field">
                <h4 data-ui-key="Categories">Categories</h4>
                <p>${Array.isArray(submission.category) ? submission.category.join(', ') : submission.category}</p>
              </div>
              ` : ''}

              ${submission.heard_about ? `
              <div class="submission-field">
                <h4 data-ui-key="How did you hear about us?">How did you hear about us?</h4>
                <p>${this.escapeHtml(submission.heard_about)}</p>
              </div>
              ` : ''}

            </div>

            ${submission.ai_feedback ? this.renderAIFeedback(submission.ai_feedback) : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderAIFeedback(feedback) {
    if (!feedback || typeof feedback !== 'object') return '';

    const sections = [
      'Problem Significance',
      'Target Audience', 
      'Uniqueness',
      'Feasibility',
      'Scalability',
      'Competition',
      'Business Viability',
      'Adoption Potential',
      'Risk Assessment',
      'Impact Potential'
    ];

    const feedbackSections = sections.map(section => {
      const key = section.toLowerCase().replace(/ /g, '_');
      const content = feedback[key];
      
      if (!content || !Array.isArray(content) || content.length === 0) return '';
      
      return `
        <div class="feedback-section">
          <h6 data-ui-key="${section}">${section}</h6>
          <ul>
            ${content.map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      `;
    }).filter(Boolean).join('');

    if (!feedbackSections) return '';

    return `
      <div class="ai-feedback">
        <h5 data-ui-key="AI Feedback">AI Feedback</h5>
        <div class="feedback-sections">
          ${feedbackSections}
        </div>
      </div>
    `;
  }

  getDraftSidebarHTML() {
    return `
      <div id="draft-sidebar" class="draft-sidebar">
        <div class="draft-sidebar-header">
          <h3 data-ui-key="Draft History">Draft History</h3>
          <button class="draft-sidebar-close" aria-label="Close">×</button>
        </div>
        <div class="draft-sidebar-content">
          <!-- Content populated dynamically -->
        </div>
      </div>
    `;
  }

  // Screen 3: Enhanced Submit Ideas with conversational tone
  async loadSubmitScreen() {
    // Load user and project dropdowns
    await this.loadUserSelect();
    await this.loadProjectSelect();
    
    // Setup form submission
    this.setupSubmitForm();
    
    // Setup textarea autosize
    this.setupTextareaAutosize();
    
    // Setup word counters
    this.setupWordCounters();
  }

async loadUserSelect() {
  const userSelect = document.getElementById('user-select');
  if (!userSelect) return;

  const users = await dbHelper.getUsers();
  
  userSelect.innerHTML = `
    <option value="">Select User</option>
    ${users.map(user => `<option value="${this.escapeHtml(user)}">${this.escapeHtml(user)}</option>`).join('')}
  `;

  userSelect.addEventListener('change', async (e) => {
    const selectedUser = e.target.value;
    
    if (selectedUser) {
      // Prompt for PIN authentication
      const pin = prompt(`Enter your 4-digit PIN for ${selectedUser}:`);
      
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        this.showMessage("PIN must be exactly 4 digits", "error");
        e.target.value = '';
        return;
      }

      try {
        const isValidPin = await dbHelper.validateUserPin(selectedUser, pin);
        
        if (!isValidPin) {
          this.showMessage("Invalid PIN", "error");
          e.target.value = '';
          return;
        }

        // PIN is valid, set current user and load their projects
        this.currentUser = selectedUser;
        await this.loadProjectSelect();
        this.showMessage(`Welcome back, ${selectedUser}!`, "success");
        
      } catch (error) {
        console.error("PIN validation error:", error);
        this.showMessage("Authentication failed", "error");
        e.target.value = '';
      }
    } else {
      // No user selected, clear current user and projects
      this.currentUser = null;
      this.currentProject = null;
      await this.loadProjectSelect(); // This will show empty project list
    }
  });
}

// Reverted loadProjectSelect method - separate project selection
async loadProjectSelect() {
  const projectSelect = document.getElementById('project-select');
  if (!projectSelect) return;

  if (!this.currentUser) {
    // No user selected, show empty project list
    projectSelect.innerHTML = `<option value="">Select Project</option>`;
    return;
  }

  const projects = await dbHelper.getProjectsByUser(this.currentUser);
  
  projectSelect.innerHTML = `
    <option value="">Select Project</option>
    ${projects.map(project => `<option value="${this.escapeHtml(project)}">${this.escapeHtml(project)}</option>`).join('')}
  `;

  projectSelect.addEventListener('change', (e) => {
    this.currentProject = e.target.value || null;
  });
}


 
// Reverted showCreateUserModal method - separate user creation
async showCreateUserModal() {
  const modal = this.createModal(
    'Create New User',
    `
      <div class="form-group">
        <label class="form-label">Enter your full name:</label>
        <input type="text" id="new-user-name" class="form-input" placeholder="Your name" required>
      </div>
      <div class="form-group">
        <label class="form-label">Create a 4-digit PIN for this account:</label>
        <input type="number" id="new-user-pin" class="form-input" placeholder="1234" min="1000" max="9999" required>
      </div>
    `,
    async () => {
      const name = document.getElementById('new-user-name').value.trim();
      const pin = document.getElementById('new-user-pin').value.trim();

      if (!name) {
        this.showMessage("Please enter your name", "error");
        return false;
      }

      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        this.showMessage("PIN must be exactly 4 digits", "error");
        return false;
      }

      try {
        await dbHelper.createUser(name, pin);
        this.showMessage("User created successfully", "success");
        
        // Reload user dropdown to include new user
        await this.loadUserSelect();
        
        return true; // This tells the modal to close
      } catch (error) {
        console.error("Error creating user:", error);
        this.showMessage("Failed to create user", "error");
        return false; // Keep modal open
      }
    }
  );
}

 async showCreateProjectModal() {
  if (!this.currentUser) {
    this.showMessage("Please select a user first", "error");
    return;
  }

  const modal = this.createModal(
    'Create New Project',
    `
      <div class="form-group">
        <label class="form-label">Enter project name:</label>
        <input type="text" id="new-project-name" class="form-input" placeholder="My Project" required>
      </div>
    `,
    async () => {
      const name = document.getElementById('new-project-name').value.trim();

      if (!name) {
        this.showMessage("Please enter a project name", "error");
        return false;
      }

      await dbHelper.createProject(this.currentUser, name);
      this.showMessage("Project created successfully", "success");
      
      // Reload project dropdown to include new project
      await this.loadProjectSelect();
      
      return true;
    }
  );
}

  setupSubmitForm() {
    const form = document.getElementById('submit-form');
    if (!form) return;

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', (e) => this.handleSubmission(e));
  }

  setupWordCounters() {
    const fields = [
      { id: 'ideal_customer_profile', min: 10, max: 200 },
      { id: 'product_idea', min: 15, max: 300 },
      { id: 'pain_points', min: 15, max: 250 },
      { id: 'alternatives', min: 5, max: 200 }
    ];

    fields.forEach(({ id, min, max }) => {
      const textarea = document.getElementById(id);
      const counter = document.getElementById(`${id}-count`);
      
      if (!textarea || !counter) return;

      const updateCounter = () => {
        const words = textarea.value.trim().split(/\s+/).filter(word => word.length > 0).length;
        const isOverLimit = words > max;
        const isUnderLimit = words < min && words > 0;
        
        counter.textContent = `${words} words (${min}-${max})`;
        counter.className = `word-counter ${isOverLimit ? 'over-limit' : ''}`;
        
        if (isUnderLimit) {
          counter.style.color = '#ffc107';
        } else if (isOverLimit) {
          counter.style.color = 'var(--capsera-error)';
        } else {
          counter.style.color = '#6c757d';
        }
      };

      textarea.addEventListener('input', updateCounter);
      updateCounter();
    });
  }

  // Screen 4: Enhanced Settings with language toggle functionality
  async loadSettingsScreen() {
    await this.loadLanguageSelector();
    await this.loadUsersManagement();
  }

  async loadLanguageSelector() {
    const container = document.getElementById('language-selector');
    if (!container) return;

    const currentLang = translator.getCurrentLanguage();
    
    const html = translator.supportedLangs.map(lang => `
      <div class="language-option ${lang === currentLang ? 'selected' : ''}" 
           data-lang="${lang}" 
           onclick="app.changeLanguage('${lang}')">
        ${translator.getLanguageName(lang)}
      </div>
    `).join('');
    
    container.innerHTML = html;
  }

  async changeLanguage(newLang) {
    if (newLang === this.currentLanguage) return;

    const wasSuccessful = translator.setCurrentLanguage(newLang);
    if (!wasSuccessful) {
      this.showMessage("Sorry, that language isn't supported yet", "error");
      return;
    }

    this.currentLanguage = newLang;
    
    // Show loading message
    this.showMessage("Updating language...", "info");
    
    try {
      // Get new translations
      this.translations = await translator.getTranslations(newLang);
      
      // Apply translations
      translator.applyTranslations(this.translations);
      
      // Update language selector
      document.querySelectorAll('.language-option').forEach(option => {
        option.classList.toggle('selected', option.getAttribute('data-lang') === newLang);
      });
      
      this.showMessage(`Language switched to ${translator.getLanguageName(newLang)}!`, "success");
    } catch (error) {
      console.error("Language change failed:", error);
      this.showMessage("Oops! Failed to update language", "error");
    }
  }

  async loadUsersManagement() {
    const container = document.getElementById('users-list');
    if (!container) return;

    const users = await dbHelper.getUsers();
    
    if (users.length === 0) {
      container.innerHTML = `
        <div class="text-center" style="padding: 2rem;">
          <div data-ui-key="No users created yet">No users created yet</div>
          <button class="btn btn-primary mt-2" onclick="app.showCreateUserModal()" data-ui-key="Create Your First User">
            Create Your First User
          </button>
        </div>
      `;
      return;
    }

    const html = users.map(user => `
      <div class="user-item">
        <span>${this.escapeHtml(user)}</span>
        <button class="btn btn-danger btn-sm" onclick="app.deleteUser('${this.escapeHtml(user)}')" data-ui-key="Delete">
          Delete
        </button>
      </div>
    `).join('');
    
    container.innerHTML = html;
  }

 
// Enhanced deleteUser method that cleans up associated data
async deleteUser(userName) {
  const pin = prompt(`Enter your 4-digit PIN to delete ${userName}:`);
  
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    this.showMessage("PIN must be exactly 4 digits", "error");
    return;
  }

  try {
    const isValidPin = await dbHelper.validateUserPin(userName, pin);
    
    if (!isValidPin) {
      this.showMessage("Oops! That PIN doesn't match", "error");
      return;
    }

    // Delete user and all associated data
    await dbHelper.deleteUserAndData(userName);
    this.showMessage("User and all associated data deleted successfully", "success");
    
    // Refresh users list
    await this.loadUsersManagement();
    
    // Clear current user if it was deleted
    if (this.currentUser === userName) {
      this.currentUser = null;
      this.currentProject = null;
      const userSelect = document.getElementById('user-select');
      const projectSelect = document.getElementById('project-select');
      if (userSelect) userSelect.value = '';
      if (projectSelect) projectSelect.value = '';
      await this.loadProjectSelect(); // This will clear the projects
    }
    
  } catch (error) {
    console.error("Delete user error:", error);
    this.showMessage("Couldn't delete user - please try again", "error");
  }
}

  // Utility methods
  
// Fixed createModal method with proper event handling
createModal(title, body, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>
      <div class="modal-body">
        ${body}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-cancel" data-ui-key="Cancel">Cancel</button>
        <button class="btn btn-primary modal-confirm" data-ui-key="Confirm">Confirm</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add event listeners after DOM insertion
  const cancelButton = overlay.querySelector('.modal-cancel');
  const confirmButton = overlay.querySelector('.modal-confirm');
  const closeButton = overlay.querySelector('.modal-close');
  
  // Cancel button
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      overlay.remove();
    });
  }
  
  // Close button (X)
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      overlay.remove();
    });
  }
  
  // Confirm button with proper async handling
  if (confirmButton && onConfirm) {
    confirmButton.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Disable button during processing
      confirmButton.disabled = true;
      confirmButton.textContent = 'Processing...';
      
      try {
        const result = await onConfirm();
        
        // Only close modal if onConfirm returns true (success)
        if (result !== false) {
          overlay.remove();
        }
      } catch (error) {
        console.error('Modal confirm error:', error);
        this.showMessage('An error occurred', 'error');
      } finally {
        // Re-enable button if modal is still open
        if (document.body.contains(overlay)) {
          confirmButton.disabled = false;
          confirmButton.textContent = 'Confirm';
        }
      }
    });
  }
  
  // Close on overlay click (outside modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  return overlay;
}

  clearForm() {
    const form = document.getElementById('submit-form');
    if (form) {
      form.reset();
      // Reset textarea heights
      this.setupTextareaAutosize();
      // Reset word counters
      this.setupWordCounters();
    }
  }

  showMessage(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      z-index: 1001 !important;
      padding: 12px 16px !important;
      border-radius: 8px !important;
      color: white !important;
      font-weight: 600 !important;
      max-width: 320px !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15) !important;
      animation: slideInRight 0.4s ease !important;
    `;

    if (type === 'success') {
      toast.style.background = 'var(--capsera-success) !important';
    } else if (type === 'error') {
      toast.style.background = 'var(--capsera-error) !important';
    } else if (type === 'warning') {
      toast.style.background = 'var(--capsera-warning) !important';
      toast.style.color = 'black !important';
    } else {
      toast.style.background = 'var(--capsera-info) !important';
    }

    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.4s ease forwards';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', registration);
      } catch (error) {
        console.error('SW registration failed:', error);
      }
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

  async syncOfflineData() {
    if (!this.isOnline) return;

    try {
      const queuedSubmissions = await dbHelper.getSyncQueue();
      
      for (const submission of queuedSubmissions) {
        try {
          await supabaseHelper.submitFinalIdea(submission);
          await dbHelper.removeFromSyncQueue(submission.id);
          console.log('Synced offline submission:', submission.id);
        } catch (error) {
          console.error('Failed to sync submission:', error);
        }
      }
      
      if (queuedSubmissions.length > 0) {
        this.showMessage(`Synced ${queuedSubmissions.length} offline submissions`, 'success');
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new CapseraApp();
  });
} else {
  window.app = new CapseraApp();
}
