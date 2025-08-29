export const dbHelper = {
  dbName: "CapseraDB",
  version: 3,
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains("feedback_local")) {
          const feedbackStore = db.createObjectStore("feedback_local", {
            keyPath: "id",
          });
          feedbackStore.createIndex("status", "status", { unique: false });
          feedbackStore.createIndex("submitted_at", "submitted_at", {
            unique: false,
          });
          feedbackStore.createIndex("device_id", "device_id", {
            unique: false,
          });
        }
        if (!db.objectStoreNames.contains("users")) {
          const userStore = db.createObjectStore("users", {
            keyPath: "full_name",
          });
          userStore.createIndex("pin_hash", "pin_hash", { unique: false });
        }

        if (!db.objectStoreNames.contains("drafts")) {
          const draftStore = db.createObjectStore("drafts", {
            keyPath: "id",
            autoIncrement: true,
          });
          draftStore.createIndex("full_name", "full_name", { unique: false });
          draftStore.createIndex("project_name", "project_name", {
            unique: false,
          });
          draftStore.createIndex(
            "user_project",
            ["full_name", "project_name"],
            { unique: false }
          );
          draftStore.createIndex("version", "version", { unique: false });
        } else {
          const draftStore = event.target.transaction.objectStore("drafts");
          if (!draftStore.indexNames.contains("project_name")) {
            draftStore.createIndex("project_name", "project_name", {
              unique: false,
            });
          }
          if (!draftStore.indexNames.contains("user_project")) {
            draftStore.createIndex(
              "user_project",
              ["full_name", "project_name"],
              { unique: false }
            );
          }
        }

        if (!db.objectStoreNames.contains("cached_ideas")) {
          db.createObjectStore("cached_ideas", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("translations")) {
          db.createObjectStore("translations", { keyPath: "language" });
        }

        if (!db.objectStoreNames.contains("sync_queue")) {
          db.createObjectStore("sync_queue", {
            keyPath: "key",
            autoIncrement: true,
          });
        }

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };
    });
  },

  async getDB() {
    if (!this.db) {
      await this.init();
    }
    return this.db;
  },

  getDeviceId() {
    let deviceId = localStorage.getItem("capsera_device_id");
    if (!deviceId) {
      deviceId = "device_" + Math.random().toString(36).substr(2, 16);
      localStorage.setItem("capsera_device_id", deviceId);
    }
    return deviceId;
  },

  hashPin(pin) {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  },

  async saveUser(fullName, pinHash) {
    const db = await this.getDB();
    const transaction = db.transaction(["users"], "readwrite");
    const store = transaction.objectStore("users");

    const user = {
      full_name: fullName,
      pin_hash: pinHash,
      created_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(user);
      request.onsuccess = () => resolve(user);
      request.onerror = () => reject(request.error);
    });
  },

  // Add this method to your db.js file
async deleteUserWithProjects(fullName) {
  const db = await this.getDB();
  
  // Start a transaction that covers all stores we need to modify
  const transaction = db.transaction(["users", "projects", "drafts", "sync_queue"], "readwrite");
  const usersStore = transaction.objectStore("users");
  const projectsStore = transaction.objectStore("projects");
  const draftsStore = transaction.objectStore("drafts");
  const syncQueueStore = transaction.objectStore("sync_queue");

  return new Promise((resolve, reject) => {
    let operationsComplete = 0;
    const totalOperations = 4; // users, projects, drafts, sync_queue
    
    const checkComplete = () => {
      operationsComplete++;
      if (operationsComplete === totalOperations) {
        resolve(true);
      }
    };

    const handleError = (error) => {
      console.error("Error in deleteUserWithProjects:", error);
      reject(error);
    };

    // 1. Delete user
    const deleteUserRequest = usersStore.delete(fullName);
    deleteUserRequest.onsuccess = checkComplete;
    deleteUserRequest.onerror = () => handleError(deleteUserRequest.error);

    // 2. Delete all projects for this user
    const projectsIndex = projectsStore.index("full_name");
    const projectsRequest = projectsIndex.openCursor(IDBKeyRange.only(fullName));
    
    projectsRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        checkComplete();
      }
    };
    projectsRequest.onerror = () => handleError(projectsRequest.error);

    // 3. Delete all drafts for this user
    const draftsIndex = draftsStore.index("full_name");
    const draftsRequest = draftsIndex.openCursor(IDBKeyRange.only(fullName));
    
    draftsRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        checkComplete();
      }
    };
    draftsRequest.onerror = () => handleError(draftsRequest.error);

    // 4. Delete all sync queue entries for this user
    const syncIndex = syncQueueStore.index("full_name");
    const syncRequest = syncIndex.openCursor(IDBKeyRange.only(fullName));
    
    syncRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        checkComplete();
      }
    };
    syncRequest.onerror = () => handleError(syncRequest.error);
  });
},

  // Add these methods to your db.js file

// Get all users for the current device
async getUsers() {
  const db = await this.getDB();
  const transaction = db.transaction(["users"], "readonly");
  const store = transaction.objectStore("users");
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const users = request.result || [];
      // Return just the user names
      resolve(users.map(user => user.full_name));
    };
    request.onerror = () => reject(request.error);
  });
},

// Create a new user with PIN (local storage)
async createUser(fullName, pin) {
  const db = await this.getDB();
  const transaction = db.transaction(["users"], "readwrite");
  const store = transaction.objectStore("users");
  
  // Hash the PIN for security
  const hashedPin = await this.hashPin(pin);
  
  const userData = {
    full_name: fullName,
    pin_hash: hashedPin,
    device_id: this.getDeviceId(),
    created_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const request = store.put(userData);
    request.onsuccess = () => resolve(userData);
    request.onerror = () => {
      if (request.error.name === 'ConstraintError') {
        reject(new Error('User already exists'));
      } else {
        reject(request.error);
      }
    };
  });
},

// Validate user PIN
async validateUserPin(fullName, pin) {
  const db = await this.getDB();
  const transaction = db.transaction(["users"], "readonly");
  const store = transaction.objectStore("users");
  
  return new Promise((resolve, reject) => {
    const request = store.get(fullName);
    request.onsuccess = async () => {
      const user = request.result;
      if (!user) {
        resolve(false);
        return;
      }
      
      try {
        const hashedPin = await this.hashPin(pin);
        resolve(user.pin_hash === hashedPin);
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
},

// Get projects for a specific user
async getProjectsByUser(userName) {
  const db = await this.getDB();
  const transaction = db.transaction(["projects"], "readonly");
  const store = transaction.objectStore("projects");
  const index = store.index("full_name");
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(userName);
    request.onsuccess = () => {
      const projects = request.result || [];
      // Return just the project names
      resolve(projects.map(project => project.project_name));
    };
    request.onerror = () => reject(request.error);
  });
},

// Create a new project for a user
async createProject(userName, projectName) {
  const db = await this.getDB();
  const transaction = db.transaction(["projects"], "readwrite");
  const store = transaction.objectStore("projects");
  
  const projectData = {
    id: `${userName}-${projectName}`,
    full_name: userName,
    project_name: projectName,
    device_id: this.getDeviceId(),
    created_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const request = store.put(projectData);
    request.onsuccess = () => resolve(projectData);
    request.onerror = () => {
      if (request.error.name === 'ConstraintError') {
        reject(new Error('Project already exists'));
      } else {
        reject(request.error);
      }
    };
  });
},

// Simple PIN hashing function
async hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + this.getDeviceId()); // Salt with device ID
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
},

  // Save feedback locally (for offline support)
  async saveFeedback(feedbackData) {
    const db = await this.getDB();
    const transaction = db.transaction(["feedback_local"], "readwrite");
    const store = transaction.objectStore("feedback_local");

    return new Promise((resolve, reject) => {
      const request = store.add(feedbackData);
      request.onsuccess = () => resolve(feedbackData);
      request.onerror = () => reject(request.error);
    });
  },

  // Get pending feedback that needs to be synced
  async getPendingFeedback() {
    const db = await this.getDB();
    const transaction = db.transaction(["feedback_local"], "readonly");
    const store = transaction.objectStore("feedback_local");

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const allFeedback = request.result || [];
        // Return only feedback that hasn't been synced
        const pending = allFeedback.filter((f) => f.status === "pending_sync");
        resolve(pending);
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Mark feedback as synced
  async markFeedbackSynced(feedbackId) {
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
          putRequest.onsuccess = () => resolve(feedback);
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  },

  // Get all feedback (for debugging/admin purposes)
  async getAllFeedback() {
    const db = await this.getDB();
    const transaction = db.transaction(["feedback_local"], "readonly");
    const store = transaction.objectStore("feedback_local");

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  // Clean up old synced feedback (optional - call periodically)
  async cleanupSyncedFeedback(olderThanDays = 7) {
    const db = await this.getDB();
    const transaction = db.transaction(["feedback_local"], "readwrite");
    const store = transaction.objectStore("feedback_local");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const allFeedback = request.result || [];
        const toDelete = allFeedback.filter(
          (f) => f.status === "synced" && new Date(f.synced_at) < cutoffDate
        );

        // Delete old synced feedback
        const deletePromises = toDelete.map(
          (feedback) =>
            new Promise((resolveDelete, rejectDelete) => {
              const deleteRequest = store.delete(feedback.id);
              deleteRequest.onsuccess = () => resolveDelete(feedback.id);
              deleteRequest.onerror = () => rejectDelete(deleteRequest.error);
            })
        );

        Promise.all(deletePromises)
          .then((deletedIds) => {
            console.log(`Cleaned up ${deletedIds.length} old feedback entries`);
            resolve(deletedIds);
          })
          .catch(reject);
      };

      request.onerror = () => reject(request.error);
    });
  },

  async getUser(fullName) {
    const db = await this.getDB();
    const transaction = db.transaction(["users"], "readonly");
    const store = transaction.objectStore("users");

    return new Promise((resolve, reject) => {
      const request = store.get(fullName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async getAllUsers() {
    const db = await this.getDB();
    const transaction = db.transaction(["users"], "readonly");
    const store = transaction.objectStore("users");

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteUser(fullName) {
    const db = await this.getDB();
    const transaction = db.transaction(["users"], "readwrite");
    const store = transaction.objectStore("users");

    return new Promise((resolve, reject) => {
      const request = store.delete(fullName);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async saveDraft(submission) {
    const db = await this.getDB();
    const transaction = db.transaction(["drafts"], "readwrite");
    const store = transaction.objectStore("drafts");

    if (!submission.project_name) {
      submission.project_name = "Default Project";
    }

    const draft = {
      ...submission,
      saved_at: new Date().toISOString(),
      synced: false,
    };

    return new Promise((resolve, reject) => {
      const request = store.add(draft);
      request.onsuccess = () => resolve({ ...draft, id: request.result });
      request.onerror = () => reject(request.error);
    });
  },

  async getDraftsByUser(fullName) {
    const db = await this.getDB();
    const transaction = db.transaction(["drafts"], "readonly");
    const store = transaction.objectStore("drafts");
    const index = store.index("full_name");

    return new Promise((resolve, reject) => {
      const request = index.getAll(fullName);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async isDraftPlaceholder(draft) {
  if (!draft) return true;
  
  const fields = [
    draft.ideal_customer_profile,
    draft.product_idea, 
    draft.pain_points,
    draft.alternatives
  ];
  
  // Check if all fields are empty, null, or contain "Not specified"
  const hasRealContent = fields.some(field => {
    if (!field) return false;
    const trimmed = field.trim();
    return trimmed.length > 0 && !trimmed.includes('Not specified');
  });
  
  // Also check if version is 1 and it's the auto-generated first draft
  const isEmptyFirstDraft = draft.version === 1 && !hasRealContent;
  
  return !hasRealContent || isEmptyFirstDraft;
},

  async removeFromSyncQueue(key) {
    const db = await this.getDB();
    const transaction = db.transaction(["sync_queue"], "readwrite");
    const store = transaction.objectStore("sync_queue");

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async getDraftsByUserAndProject(fullName, projectName) {
    const db = await this.getDB();
    const transaction = db.transaction(["drafts"], "readonly");
    const store = transaction.objectStore("drafts");
    const index = store.index("user_project");

    return new Promise((resolve, reject) => {
      const request = index.getAll([fullName, projectName]);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async getAllDrafts() {
    const db = await this.getDB();
    const transaction = db.transaction(["drafts"], "readonly");
    const store = transaction.objectStore("drafts");

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteDraft(id) {
    const db = await this.getDB();
    const transaction = db.transaction(["drafts"], "readwrite");
    const store = transaction.objectStore("drafts");

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteDraftsByUserAndProject(fullName, projectName) {
    const drafts = await this.getDraftsByUserAndProject(fullName, projectName);
    const deletePromises = drafts.map((draft) => this.deleteDraft(draft.id));
    return Promise.all(deletePromises);
  },

  async cacheIdeas(ideas) {
    const db = await this.getDB();
    const transaction = db.transaction(["cached_ideas"], "readwrite");
    const store = transaction.objectStore("cached_ideas");

    await new Promise((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    const promises = ideas.map((idea) => {
      return new Promise((resolve, reject) => {
        const request = store.add({
          ...idea,
          cached_at: new Date().toISOString(),
        });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });

    return Promise.all(promises);
  },

  async getCachedIdeas() {
    const db = await this.getDB();
    const transaction = db.transaction(["cached_ideas"], "readonly");
    const store = transaction.objectStore("cached_ideas");

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async cacheTranslations(language, translations) {
    const db = await this.getDB();
    const transaction = db.transaction(["translations"], "readwrite");
    const store = transaction.objectStore("translations");

    const record = {
      language,
      translations,
      cached_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  },

  async getCachedTranslations(language) {
    const db = await this.getDB();
    const transaction = db.transaction(["translations"], "readonly");
    const store = transaction.objectStore("translations");

    return new Promise((resolve, reject) => {
      const request = store.get(language);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        const cacheAge = Date.now() - new Date(result.cached_at).getTime();
        const maxAge = 24 * 60 * 60 * 1000;

        if (cacheAge > maxAge) {
          resolve(null);
        } else {
          resolve(result.translations);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async addToSyncQueue(item) {
    const db = await this.getDB();
    const transaction = db.transaction(["sync_queue"], "readwrite");
    const store = transaction.objectStore("sync_queue");

    const queueItem = {
      ...item,
      queued_at: new Date().toISOString(),
      attempts: 0,
    };

    return new Promise((resolve, reject) => {
      const request = store.add(queueItem);
      request.onsuccess = () => resolve({ ...queueItem, key: request.result });
      request.onerror = () => reject(request.error);
    });
  },

  async getSyncQueue() {
    const db = await this.getDB();
    const transaction = db.transaction(["sync_queue"], "readonly");
    const store = transaction.objectStore("sync_queue");

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async removeFromSyncQueue(key) {
    const db = await this.getDB();
    const transaction = db.transaction(["sync_queue"], "readwrite");
    const store = transaction.objectStore("sync_queue");

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async saveSetting(key, value) {
    const db = await this.getDB();
    const transaction = db.transaction(["settings"], "readwrite");
    const store = transaction.objectStore("settings");

    const setting = {
      key,
      value,
      updated_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(setting);
      request.onsuccess = () => resolve(setting);
      request.onerror = () => reject(request.error);
    });
  },

  async getSetting(key, defaultValue = null) {
    const db = await this.getDB();
    const transaction = db.transaction(["settings"], "readonly");
    const store = transaction.objectStore("settings");

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async clearCache() {
    const db = await this.getDB();
    const transaction = db.transaction(
      ["cached_ideas", "translations"],
      "readwrite"
    );

    const promises = [
      new Promise((resolve, reject) => {
        const request = transaction.objectStore("cached_ideas").clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = transaction.objectStore("translations").clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ];

    return Promise.all(promises);
  },

  async getDatabaseSize() {
    const db = await this.getDB();
    let totalSize = 0;

    const storeNames = [
      "users",
      "drafts",
      "cached_ideas",
      "translations",
      "sync_queue",
      "settings",
    ];

    for (const storeName of storeNames) {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);

      const count = await new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      totalSize += count;
    }

    return totalSize;
  },
};

dbHelper.init().catch(console.error);
