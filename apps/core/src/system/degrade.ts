/**
 * Degrade Policy Module
 * Phase 4.3: 猝死保护 (Graceful Degradation)
 *
 * Monitors service health and manages degraded mode:
 * - Brain down → Write to DLQ, continue in local mode
 * - Service recovered → Auto-reconnect and replay DLQ
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CHECK_INTERVAL_MS = 30000; // 30 seconds
const BRAIN_API = process.env.BRAIN_API || 'http://localhost:5220';
const WORKSPACE_API = process.env.WORKSPACE_API || 'http://localhost:5212';
const DLQ_SCRIPT = path.resolve(__dirname, '../../../../scripts/dlq-utils.sh');

// Service health state
interface ServiceHealth {
  healthy: boolean;
  lastCheck: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
}

interface DegradeState {
  degraded: boolean;
  reason: string | null;
  enteredAt: Date | null;
  services: {
    brain: ServiceHealth;
    workspace: ServiceHealth;
  };
}

// Global state
let state: DegradeState = {
  degraded: false,
  reason: null,
  enteredAt: null,
  services: {
    brain: { healthy: true, lastCheck: null, lastError: null, consecutiveFailures: 0 },
    workspace: { healthy: true, lastCheck: null, lastError: null, consecutiveFailures: 0 },
  },
};

let checkIntervalId: NodeJS.Timeout | null = null;

/**
 * Check if a service is healthy
 */
async function checkServiceHealth(
  name: string,
  url: string,
  timeoutMs: number = 5000
): Promise<{ healthy: boolean; error: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      return { healthy: true, error: null };
    }
    return { healthy: false, error: `HTTP ${response.status}` };
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { healthy: false, error: message };
  }
}

/**
 * Update service health state
 */
function updateServiceHealth(
  service: 'brain' | 'workspace',
  result: { healthy: boolean; error: string | null }
): void {
  const svc = state.services[service];
  svc.lastCheck = new Date();

  if (result.healthy) {
    svc.healthy = true;
    svc.lastError = null;
    svc.consecutiveFailures = 0;
  } else {
    svc.healthy = false;
    svc.lastError = result.error;
    svc.consecutiveFailures++;
  }
}

/**
 * Evaluate and update degraded state
 */
function evaluateDegradeState(): void {
  const brainDown = !state.services.brain.healthy;
  const workspaceDown = !state.services.workspace.healthy;

  const shouldDegrade = brainDown; // We only degrade if Brain is down

  if (shouldDegrade && !state.degraded) {
    // Enter degraded mode
    state.degraded = true;
    state.reason = brainDown ? 'Brain service unavailable' : 'Service unavailable';
    state.enteredAt = new Date();
    console.log(`[DEGRADE] Entered degraded mode: ${state.reason}`);
  } else if (!shouldDegrade && state.degraded) {
    // Exit degraded mode
    console.log(`[DEGRADE] Services recovered, exiting degraded mode`);
    state.degraded = false;
    state.reason = null;
    state.enteredAt = null;

    // Trigger DLQ replay on recovery
    triggerDLQReplay().catch((err) => {
      console.error('[DEGRADE] DLQ replay failed:', err);
    });
  }
}

/**
 * Trigger DLQ replay when services recover
 */
async function triggerDLQReplay(): Promise<void> {
  try {
    console.log('[DEGRADE] Triggering DLQ replay...');
    const { stdout: statusOutput } = await execAsync(`bash ${DLQ_SCRIPT} status`);
    const status = JSON.parse(statusOutput);

    if (status.total_pending > 0) {
      console.log(`[DEGRADE] Found ${status.total_pending} pending DLQ entries, replaying...`);

      if (status.memory.pending > 0) {
        const { stdout: memoryResult } = await execAsync(`bash ${DLQ_SCRIPT} replay memory`);
        console.log('[DEGRADE] Memory replay:', JSON.parse(memoryResult));
      }

      if (status.evidence.pending > 0) {
        const { stdout: evidenceResult } = await execAsync(`bash ${DLQ_SCRIPT} replay evidence`);
        console.log('[DEGRADE] Evidence replay:', JSON.parse(evidenceResult));
      }
    } else {
      console.log('[DEGRADE] No pending DLQ entries');
    }
  } catch (error) {
    console.error('[DEGRADE] DLQ replay error:', error);
    throw error;
  }
}

/**
 * Run health check cycle
 */
async function runHealthCheck(): Promise<void> {
  // Check Brain
  const brainResult = await checkServiceHealth('brain', `${BRAIN_API}/api/brain/tick/status`);
  updateServiceHealth('brain', brainResult);

  // Check Workspace (self-check, should always pass unless server is crashing)
  const workspaceResult = await checkServiceHealth('workspace', `${WORKSPACE_API}/api/system/health`);
  updateServiceHealth('workspace', workspaceResult);

  // Evaluate degraded state
  evaluateDegradeState();
}

/**
 * Start periodic health checks
 */
export function startHealthChecks(): void {
  if (checkIntervalId) {
    console.log('[DEGRADE] Health checks already running');
    return;
  }

  console.log(`[DEGRADE] Starting health checks (interval: ${CHECK_INTERVAL_MS}ms)`);

  // Run immediately
  runHealthCheck().catch((err) => {
    console.error('[DEGRADE] Health check error:', err);
  });

  // Then run periodically
  checkIntervalId = setInterval(() => {
    runHealthCheck().catch((err) => {
      console.error('[DEGRADE] Health check error:', err);
    });
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop periodic health checks
 */
export function stopHealthChecks(): void {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
    console.log('[DEGRADE] Health checks stopped');
  }
}

/**
 * Get current degrade state
 */
export function getDegradeState(): DegradeState {
  return { ...state };
}

/**
 * Check if system is degraded
 */
export function isDegraded(): boolean {
  return state.degraded;
}

/**
 * Manually trigger degraded mode (for testing)
 */
export function setDegraded(degraded: boolean, reason?: string): void {
  if (degraded) {
    state.degraded = true;
    state.reason = reason || 'Manual degradation';
    state.enteredAt = new Date();
    console.log(`[DEGRADE] Manually entered degraded mode: ${state.reason}`);
  } else {
    state.degraded = false;
    state.reason = null;
    state.enteredAt = null;
    console.log('[DEGRADE] Manually exited degraded mode');
  }
}

/**
 * Run immediate health check
 */
export async function checkNow(): Promise<DegradeState> {
  await runHealthCheck();
  return getDegradeState();
}
