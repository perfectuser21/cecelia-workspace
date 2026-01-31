/* global console */
/**
 * Context Manager for Intent Recognition
 *
 * Manages conversation context to support pronoun resolution and entity references.
 * Uses LRU (Least Recently Used) cache strategy to store recent entities.
 */

/**
 * Context storage
 * Structure: Map<session_id, { entities: Array, timestamp: number }>
 */
const contexts = new Map();

/**
 * Configuration
 */
const CONFIG = {
  MAX_ENTITIES_PER_SESSION: 10,  // Store last 10 entities
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,  // 30 minutes
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000   // Clean up every 5 minutes
};

/**
 * Initialize context for a session
 * @param {string} session_id - Session identifier
 * @returns {void}
 */
function initContext(session_id) {
  if (!contexts.has(session_id)) {
    contexts.set(session_id, {
      entities: [],
      timestamp: Date.now()
    });
  }
}

/**
 * Store an entity in session context
 * @param {string} session_id - Session identifier
 * @param {Object} entity - Entity to store (e.g., { type: 'goal', id: '123', title: '...' })
 * @returns {void}
 */
function storeEntity(session_id, entity) {
  if (!session_id || !entity) {
    return;
  }

  initContext(session_id);

  const context = contexts.get(session_id);

  // Add entity to the beginning (most recent)
  context.entities.unshift({
    ...entity,
    timestamp: Date.now()
  });

  // Keep only MAX_ENTITIES_PER_SESSION most recent
  if (context.entities.length > CONFIG.MAX_ENTITIES_PER_SESSION) {
    context.entities = context.entities.slice(0, CONFIG.MAX_ENTITIES_PER_SESSION);
  }

  // Update session timestamp
  context.timestamp = Date.now();
}

/**
 * Get the most recent entity of a specific type
 * @param {string} session_id - Session identifier
 * @param {string} entityType - Type of entity to retrieve (e.g., 'goal', 'task', 'project')
 * @returns {Object|null} - Most recent entity of the specified type, or null
 */
function getRecentEntity(session_id, entityType = null) {
  const context = contexts.get(session_id);

  if (!context || !context.entities || context.entities.length === 0) {
    return null;
  }

  // If no type specified, return the most recent entity
  if (!entityType) {
    return context.entities[0];
  }

  // Find the most recent entity of the specified type
  return context.entities.find(e => e.type === entityType) || null;
}

/**
 * Resolve pronouns in input text to actual entity IDs
 * @param {string} session_id - Session identifier
 * @param {string} input - Input text that may contain pronouns
 * @returns {Object|null} - Resolved entity or null if no pronoun/entity found
 */
function resolvePronoun(session_id, input) {
  const pronounPatterns = [
    /那个(目标|任务|项目)/,
    /(它|他|她)/,
    /this\s+(goal|task|project)/i,
    /that\s+(goal|task|project)/i
  ];

  // Check if input contains pronoun patterns
  let entityType = null;
  for (const pattern of pronounPatterns) {
    const match = input.match(pattern);
    if (match) {
      // Extract entity type from pronoun context
      if (match[1]) {
        const typeMap = {
          '目标': 'goal',
          '任务': 'task',
          '项目': 'project',
          'goal': 'goal',
          'task': 'task',
          'project': 'project'
        };
        entityType = typeMap[match[1]] || null;
      }
      break;
    }
  }

  // If no pronoun found, return null
  if (!entityType && !input.match(/它|他|她|this|that/i)) {
    return null;
  }

  // Get the most recent entity of the type (or any if type not specified)
  return getRecentEntity(session_id, entityType);
}

/**
 * Get all entities in session context
 * @param {string} session_id - Session identifier
 * @returns {Array} - All entities in the session
 */
function getAllEntities(session_id) {
  const context = contexts.get(session_id);
  return context?.entities || [];
}

/**
 * Clear session context
 * @param {string} session_id - Session identifier
 * @returns {void}
 */
function clearContext(session_id) {
  contexts.delete(session_id);
}

/**
 * Cleanup expired sessions
 * Removes sessions that haven't been active for SESSION_TIMEOUT_MS
 * @returns {number} - Number of sessions cleaned up
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [session_id, context] of contexts.entries()) {
    if (now - context.timestamp > CONFIG.SESSION_TIMEOUT_MS) {
      contexts.delete(session_id);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

/**
 * Get context statistics (for debugging/monitoring)
 * @returns {Object} - Statistics about active contexts
 */
function getStats() {
  const now = Date.now();
  const stats = {
    totalSessions: contexts.size,
    activeSessions: 0,
    totalEntities: 0,
    oldestSession: null,
    newestSession: null
  };

  let oldestTime = Infinity;
  let newestTime = 0;

  for (const context of contexts.values()) {
    const age = now - context.timestamp;
    if (age < CONFIG.SESSION_TIMEOUT_MS) {
      stats.activeSessions++;
    }
    stats.totalEntities += context.entities.length;

    if (context.timestamp < oldestTime) {
      oldestTime = context.timestamp;
      stats.oldestSession = new Date(context.timestamp).toISOString();
    }
    if (context.timestamp > newestTime) {
      newestTime = context.timestamp;
      stats.newestSession = new Date(context.timestamp).toISOString();
    }
  }

  return stats;
}

// Periodic cleanup
let cleanupTimer = null;

function startCleanup() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      const cleaned = cleanupExpiredSessions();
      if (cleaned > 0) {
        console.log(`[ContextManager] Cleaned up ${cleaned} expired sessions`);
      }
    }, CONFIG.CLEANUP_INTERVAL_MS);
  }
}

function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

// Auto-start cleanup on module load
startCleanup();

export {
  initContext,
  storeEntity,
  getRecentEntity,
  resolvePronoun,
  getAllEntities,
  clearContext,
  cleanupExpiredSessions,
  getStats,
  startCleanup,
  stopCleanup,
  CONFIG
};
