// app.js - Enhanced with compact submission cards, autosize textareas, and conversational tone
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
    this.sidebarDrafts = []; // Store drafts for sidebar

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
        target.style.height = Math.max(target.scrollHeight, 100) + "px"; // Min height 100px
      };

      textarea.addEventListener("input", handleInput);

      // Initial size adjustment
      textarea.style.height = "auto";
      textarea.style.height = Math.max(textarea.scrollHeight, 100) + "px";
    });
  }

  // Enhanced card toggle functionality with smooth animations
  setupSubmissionCardToggles() {
    const cards = document.querySelectorAll(".submission-card");

    cards.forEach((card, index) => {
      const chevron = card.querySelector(".submission-card-chevron");
      const header = card.querySelector(".submission-card-header");

      if (!chevron || !header) return;

      // Remove existing listeners
      const newChevron = chevron.cloneNode(true);
      chevron.parentNode.replaceChild(newChevron, chevron);
      
      const newHeader = header.cloneNode(true);
      header.parentNode.replaceChild(newHeader, header);

      const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isExpanded = card.classList.contains("submission-card--expanded");

        // Close other cards for better UX
        cards.forEach((otherCard, otherIndex) => {
          if (otherIndex !== index) {
            otherCard.classList.remove("submission-card--expanded");
            const otherChevron = otherCard.querySelector(".submission-card-chevron");
            if (otherChevron) {
              otherChevron.setAttribute("aria-expanded", "false");
            }
          }
        });

        if (isExpanded) {
          card.classList.remove("submission-card--expanded");
          newChevron.setAttribute("aria-expanded", "false");
        } else {
          card.classList.add("submission-card--expanded");
          newChevron.setAttribute("aria-expanded", "true");
        }
      };

      newChevron.addEventListener("click", handleToggle);
      newHeader.addEventListener("click", handleToggle);
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

  // Screen 1: Ideas List with conversational feedback form
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
    const userName = this.currentUser || 'there';
    return `
      <div class="feedback-section">
        <h3>Hey ${this.escapeHtml(userName)}, how can we make Capsera better for you?</h3>
        <form id="feedback-form" class="feedback-form">
          <div class="form-group">
            <label class="form-label">What's on your mind?</label>
            <textarea id="feedback-message" class="form-textarea" 
                     placeholder="Tell us what you love, what frustrates you, or any wild ideas you have..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Want us to follow up? (Optional)</label>
            <input type="text" id="feedback-contact" class="form-input" 
                   placeholder="Drop your email or phone if you'd like us to get back to you">
          </div>
          <button type="submit" class="btn btn-primary">Send It Over!</button>
        </form>
      </div>
    `;
  }

  // Screen 2: Enhanced My Submissions with compact cards and sidebar
  async loadSubmissionsScreen() {
    const container = document.getElementById("submissions-list");
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading your submissions...</div>';

    try {
      const submissions = await dbHelper.getAllDrafts();
      this.sidebarDrafts = submissions; // Store for sidebar
      this.renderSubmissionsWithSidebar(submissions);
    } catch (error) {
      console.error("Error loading submissions:", error);
      container.innerHTML = '<div class="error">Failed to load submissions</div>';
    }
  }

  renderSubmissionsWithSidebar(submissions) {
    const container = document.getElementById("submissions-list");
    if (!container) return;

    if (submissions.length === 0) {
      const userName = this.currentUser || 'friend';
      container.innerHTML = `
        <div class="text-center">
          <p>Hey ${this.escapeHtml(userName)}, you haven't submitted any ideas yet!</p>
          <p>Ready to share something amazing with the world?</p>
          <button class="btn btn-primary" onclick="app.showScreen('submit')">
            Let's Get Started!
          </button>
        </div>
      `;
      return;
    }

    // Group by user and project
    const grouped = this.groupSubmissions(submissions);
    
    const sidebarHTML = this.renderDraftsSidebar(submissions);
    const mainHTML = this.renderCompactSubmissions(grouped);

    container.innerHTML = `
      <div class="submissions-layout">
        <div class="submissions-sidebar">
          ${sidebarHTML}
        </div>
        <div class="submissions-main">
          ${mainHTML}
        </div>
      </div>
    `;

    // Setup card toggles after rendering
    this.setupSubmissionCardToggles();
  }

  renderDraftsSidebar(submissions) {
    const recentDrafts = submissions
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10); // Show last 10 drafts

    return `
      <div class="drafts-sidebar">
        <h4>Recent Drafts</h4>
        <div class="drafts-list">
          ${recentDrafts.map(draft => `
            <div class="draft-item" onclick="app.scrollToSubmission('${draft.full_name}', '${draft.project_name}')">
              <div class="draft-title">${this.escapeHtml(draft.project_name)}</div>
              <div class="draft-meta">
                ${this.escapeHtml(draft.full_name)} • Draft ${draft.version || 1}
              </div>
              <div class="draft-date">
                ${new Date(draft.created_at).toLocaleDateString()}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderCompactSubmissions(grouped) {
    const userName = Object.keys(grouped)[0] || 'there';
    
    return `
      <div class="submissions-header">
        <h3>Hey ${this.escapeHtml(userName)}, here are your submissions!</h3>
        <p>Click on any project to expand and see your drafts</p>
      </div>
      ${Object.entries(grouped).map(([user, projects]) => `
        <div class="user-section" id="user-${this.escapeHtml(user)}">
          <h3 class="user-header">
            ${this.escapeHtml(user)}'s Projects
            <span class="project-count">${Object.keys(projects).length} project${Object.keys(projects).length !== 1 ? 's' : ''}</span>
          </h3>
          <div class="user-submissions">
            ${Object.entries(projects).map(([project, submissions]) => 
              this.renderProjectCard(user, project, submissions)
            ).join('')}
          </div>
        </div>
      `).join('')}
    `;
  }

  renderProjectCard(user, project, submissions) {
    const latestSubmission = submissions[submissions.length - 1];
    const totalDrafts = submissions.length;
    const finalSubmission = submissions.find(s => s.is_final);
    
    return `
      <div class="submission-card" id="submission-${this.escapeHtml(user)}-${this.escapeHtml(project)}">
        <div class="submission-card-header">
          <div class="submission-card-title">
            <h4>${this.escapeHtml(project)}</h4>
            <span class="submission-card-meta">
              ${totalDrafts} draft${totalDrafts !== 1 ? 's' : ''} • 
              Last updated ${new Date(latestSubmission.created_at).toLocaleDateString()}
            </span>
          </div>
          <div class="submission-status">
            ${finalSubmission 
              ? '<span class="status success">Submitted</span>'
              : '<span class="status warning">In Progress</span>'
            }
            <button class="submission-card-chevron" aria-expanded="false">
              ↓
            </button>
          </div>
        </div>
        
        <div class="submission-card-body">
          <div class="submission-card-content">
            ${submissions.map((submission, index) => `
              <div class="submission-details">
                <div class="submission-header">
                  <h5>Draft ${submission.version || (index + 1)} ${submission.is_final ? '(Final)' : ''}</h5>
                  <span class="submission-meta">
                    ${new Date(submission.created_at).toLocaleString()}
                    ${submission.quality_score ? ` • Score: ${submission.quality_score}/10` : ''}
                  </span>
                </div>
                
                <div class="submission-content">
                  <div class="field-group">
                    <h6>Who's this for?</h6>
                    <p>${this.escapeHtml(submission.ideal_customer_profile || 'Not specified')}</p>
                  </div>
                  
                  <div class="field-group">
                    <h6>The Big Idea</h6>
                    <p>${this.escapeHtml(submission.product_idea || 'Not specified')}</p>
                  </div>
                  
                  <div class="field-group">
                    <h6>Problems It Solves</h6>
                    <p>${this.escapeHtml(submission.pain_points || 'Not specified')}</p>
                  </div>
                  
                  <div class="field-group">
                    <h6>What's Out There Already</h6>
                    <p>${this.escapeHtml(submission.alternatives || 'Not specified')}</p>
                  </div>
                  
                  ${submission.category ? `
                    <div class="field-group">
                      <h6>Categories</h6>
                      <p>${Array.isArray(submission.category) 
                        ? submission.category.join(', ') 
                        : submission.category
                      }</p>
                    </div>
                  ` : ''}
                </div>
                
                ${submission.ai_feedback ? this.renderAIFeedback(submission.ai_feedback) : ''}
              </div>
            `).join('<hr class="submission-divider">')}
          </div>
        </div>
      </div>
    `;
  }

  renderAIFeedback(feedback) {
    if (!feedback || typeof feedback !== 'object') return '';

    return `
      <div class="ai-feedback">
        <h5>AI Feedback</h5>
        <div class="feedback-sections">
          ${Object.entries(feedback).map(([key, value]) => {
            if (key === 'overall_score' || !Array.isArray(value)) return '';
            
            return `
              <div class="feedback-section">
                <h6>${this.formatFeedbackTitle(key)}</h6>
                <ul>
                  ${value.map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
                </ul>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  formatFeedbackTitle(key) {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  // Helper method to scroll to specific submission
  scrollToSubmission(user, project) {
    const element = document.getElementById(`submission-${user}-${project}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Expand the card
      element.classList.add("submission-card--expanded");
      const chevron = element.querySelector(".submission-card-chevron");
      if (chevron) {
        chevron.setAttribute("aria-expanded", "true");
      }
    }
  }

  // Screen 3: Enhanced Submit Ideas with conversational tone
  async loadSubmitScreen() {
    const userSelect = document.getElementById("user-select");
    const projectSelect = document.getElementById("project-select");
    
    if (!userSelect || !projectSelect) return;

    // Setup form with conversational guidance
    this.setupConversationalForm();

    // Load users and projects
    await this.loadUsersAndProjects();

    // Setup autosize textareas
    this.setupTextareaAutosize();

    // Setup word counters with conversational feedback
    this.setupConversationalWordCounters();

    // Setup form submission
    this.setupFormSubmission();
  }

  setupConversationalForm() {
    const form = document.getElementById("submit-form");
    if (!form) return;

    // Add conversational helper text
    const helperHTML = `
      <div class="form-helper">
        <p>Hey! Ready to share your amazing idea? Just fill out the fields below - we're here to help you shine! ✨</p>
      </div>
    `;
    
    form.insertAdjacentHTML('afterbegin', helperHTML);
  }

  setupConversationalWordCounters() {
    const textareas = document.querySelectorAll('textarea');
    
    textareas.forEach(textarea => {
      const counterId = textarea.id + '-count';
      const counter = document.getElementById(counterId);
      
      if (!counter) return;

      const updateCounter = () => {
        const words = textarea.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        const fieldName = textarea.id.replace(/_/g, ' ').toLowerCase();
        
        // Get word limits based on field
        let minWords, maxWords, encouragement;
        
        switch(textarea.id) {
          case 'ideal_customer_profile':
            minWords = 10; maxWords = 200;
            encouragement = words < minWords ? "Tell us more about your ideal user!" : 
                          words > maxWords ? "Maybe trim it down a bit?" : "Perfect! 👌";
            break;
          case 'product_idea':
            minWords = 15; maxWords = 300;
            encouragement = words < minWords ? "Paint us the full picture!" : 
                          words > maxWords ? "Great detail, maybe condense a little?" : "Awesome! 🚀";
            break;
          case 'pain_points':
            minWords = 15; maxWords = 250;
            encouragement = words < minWords ? "What frustrations do people have?" : 
                          words > maxWords ? "Nice insights, maybe prioritize the top ones?" : "Spot on! 🎯";
            break;
          case 'alternatives':
            minWords = 5; maxWords = 200;
            encouragement = words < minWords ? "What else is out there?" : 
                          words > maxWords ? "Good research, maybe highlight the key ones?" : "Great analysis! 📊";
            break;
          default:
            minWords = 5; maxWords = 200;
            encouragement = "Looking good!";
        }

        const isOverLimit = words > maxWords;
        const isUnderLimit = words > 0 && words < minWords;
        
        counter.innerHTML = `${words} words • ${encouragement}`;
        counter.className = `word-counter ${isOverLimit ? 'over-limit' : isUnderLimit ? 'under-limit' : 'good'}`;
      };

      textarea.addEventListener('input', updateCounter);
      updateCounter(); // Initial call
    });
  }

  async setupFormSubmission() {
    const form = document.getElementById("submit-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      await this.handleSubmission(e);
    });
  }

  // Enhanced submission handling with conversational feedback
  async handleSubmission(e) {
    e.preventDefault();

    if (!this.currentUser) {
      this.showMessage("Hey! Please pick or create a user first 👤", "error");
      return;
    }

    if (!this.currentProject) {
      this.showMessage("Almost there! Just select or create a project 📁", "error");
      return;
    }

    const formData = new FormData(e.target);

    // Get form values
    const submission = {
      device_id: dbHelper.getDeviceId(),
      full_name: this.currentUser,
      project_name: this.currentProject,
      ideal_customer_profile: formData.get("ideal_customer_profile") || "",
      product_idea: formData.get("product_idea") || "",
      pain_points: formData.get("pain_points") || "",
      alternatives: formData.get("alternatives") || "",
      category: Array.from(document.getElementById("category").selectedOptions).map(o => o.value),
      heard_about: formData.get("heard_about") || "",
    };

    // Validate submission
    const validationResult = await validation.validateSubmission(submission, this.ideas);

    if (!validationResult.passed) {
      this.showMessage(`Oops! ${validationResult.errors.join(", ")} 🤔`, "error");
      return;
    }

    submission.quality_score = validationResult.qualityScore;

    // Determine attempt number
    const existingDrafts = await dbHelper.getDraftsByUserAndProject(
      this.currentUser,
      this.currentProject
    );

    const realDrafts = existingDrafts.filter((d) => d.version > 0);
    const attemptNumber = realDrafts.length + 1;
    submission.version = attemptNumber;

    try {
      if (attemptNumber <= 2) {
        // Draft submissions with encouraging messages
        const aiFeedback = await supabaseHelper.getAIFeedback(submission);
        submission.ai_feedback = aiFeedback;

        if (aiFeedback.overall_score) {
          submission.quality_score = aiFeedback.overall_score;
        }

        await dbHelper.saveDraft(submission);

        const encouragement = attemptNumber === 1 
          ? "Great first draft! Check out the AI feedback below 🎉" 
          : "Nice improvements in draft 2! One more chance to perfect it ✨";
        
        this.showMessage(encouragement, "success");
        this.showAIFeedbackModal(aiFeedback);
        this.clearForm();
      } else if (attemptNumber === 3) {
        // Final submission
        const confirmed = confirm(
          "🚀 Ready for Launch? 🚀\n\nThis is your final submission! Once you hit submit:\n• Your idea goes live for everyone to see\n• No more changes allowed\n• It'll be part of the Capsera community forever\n\nSound good?"
        );

        if (!confirmed) return;

        const aiFeedback = await supabaseHelper.getAIFeedback(submission);
        submission.ai_feedback = aiFeedback;
        submission.is_final = true;

        if (this.isOnline) {
          await supabaseHelper.submitFinalIdea(submission);
          await supabaseHelper.createUser(this.currentUser);
          await dbHelper.saveDraft(submission);

          this.showMessage("🎉 Your idea is now live! Welcome to the Capsera community!", "success");
          this.showAIFeedbackModal(aiFeedback);
          this.clearForm();
        } else {
          await dbHelper.saveDraft(submission);
          await dbHelper.addToSyncQueue(submission);
          this.showMessage("Queued for launch when you're back online! 📡", "warning");
        }
      } else {
        this.showMessage("You've used all 3 attempts for this project. Time for a new one! 🆕", "error");
      }
    } catch (error) {
      console.error("Submission error:", error);
      this.showMessage(`Something went wrong: ${error.message}. Give it another shot! 🔄`, "error");
    }
  }

  setupFeedbackForm() {
    // Use a small delay to ensure DOM has updated after innerHTML changes
    const trySetupForm = () => {
      const form = document.getElementById("feedback-form");
      if (!form) {
        return false;
      }

      // Remove existing listeners to avoid duplicates
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
          this.showMessage("Don't be shy! Tell us what you're thinking 💭", "error");
          return;
        }

        // Show loading state
        const originalText = submitButton?.textContent || "Send It Over!";
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

          await supabaseHelper.submitFeedback(feedbackData);
          this.showMessage("Thanks for the feedback! We really appreciate it 🙏", "success");
          newForm.reset();
        } catch (error) {
          console.error("Feedback failed:", error);
          this.showMessage("Oops, couldn't send that. Mind trying again? 🤷‍♀️", "error");
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

  // Rest of the methods remain the same but with conversational tone updates
  showMessage(message, type = "info") {
    // Remove any existing toasts
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    // Style the toast based on type
    switch(type) {
      case 'success':
        toast.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        break;
      case 'error':
        toast.style.background = 'linear-gradient(135deg, #dc3545, #e74c3c)';
        break;
      case 'warning':
        toast.style.background = 'linear-gradient(135deg, #ffc107, #fd7e14)';
        break;
      default:
        toast.style.background = 'linear-gradient(135deg, #17a2b8, #6f42c1)';
    }

    document.body.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 4000);
  }

  clearForm() {
    const form = document.getElementById("submit-form");
    if (form) {
      form.reset();
      // Reset word counters
      document.querySelectorAll('.word-counter').forEach(counter => {
        counter.innerHTML = '0 words • Start typing!';
        counter.className = 'word-counter';
      });
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  groupSubmissions(submissions) {
    const grouped = {};
    
    submissions.forEach(submission => {
      const user = submission.full_name;
      const project = submission.project_name;
      
      if (!grouped[user]) {
        grouped[user] = {};
      }
      
      if (!grouped[user][project]) {
        grouped[user][project] = [];
      }
      
      grouped[user][project].push(submission);
    });
    
    return grouped;
  }

  // Placeholder methods that need to be implemented based on your existing code
  async syncOfflineData() {
    // Implementation from your existing code
  }

  async loadUsersAndProjects() {
    // Implementation from your existing code  
  }

  showScreen(screenName) {
    // Implementation from your existing code with added setup calls
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });

    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.classList.remove("active");
    });

    const screenElement = document.getElementById(`${screenName}-screen`);
    const tabElement = document.querySelector(`[data-screen="${screenName}"]`);

    if (screenElement) {
      screenElement.classList.add("active");
    }
    if (tabElement) {
      tabElement.classList.add("active");
    }

    this.currentScreen = screenName;

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

  async viewIdeaDetails(ideaId) {
    // Implementation from your existing code
  }

  showAIFeedbackModal(feedback) {
    // Implementation from your existing code
  }

  async loadSettingsScreen() {
    // Implementation from your existing code
  }
}

// Initialize app
const app = new CapseraApp();
window.app = app;
