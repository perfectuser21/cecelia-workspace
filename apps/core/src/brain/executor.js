/**
 * Cecelia Executor - Trigger headless Claude Code execution
 *
 * v2: Process-level tracking to prevent runaway dispatch.
 * - Tracks child PIDs in memory (activeProcesses Map)
 * - Deduplicates by taskId before spawning
 * - Cleans up orphan `claude -p` processes on startup
 */

/* global console */
import { spawn, execSync } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import pool from '../task-system/db.js';

// Configuration
const CECELIA_RUN_PATH = process.env.CECELIA_RUN_PATH || '/home/xx/bin/cecelia-run';
const PROMPT_DIR = '/tmp/cecelia-prompts';
const WORK_DIR = process.env.CECELIA_WORK_DIR || '/home/xx/dev/cecelia-workspace';

/**
 * In-memory process registry: taskId -> { pid, startedAt, runId, process }
 */
const activeProcesses = new Map();

/**
 * Get the number of actively tracked processes (with liveness check)
 */
function getActiveProcessCount() {
  // Prune dead processes first
  for (const [taskId, entry] of activeProcesses) {
    if (!isProcessAlive(entry.pid)) {
      console.log(`[executor] Pruning dead process: task=${taskId} pid=${entry.pid}`);
      activeProcesses.delete(taskId);
    }
  }
  return activeProcesses.size;
}

/**
 * Check if a PID is still alive
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0); // signal 0 = existence check
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill the process for a specific task
 * @returns {boolean} true if killed
 */
function killProcess(taskId) {
  const entry = activeProcesses.get(taskId);
  if (!entry) return false;

  try {
    // Kill the process group (negative PID) to catch child shells
    try {
      process.kill(-entry.pid, 'SIGTERM');
    } catch {
      process.kill(entry.pid, 'SIGTERM');
    }
    console.log(`[executor] Killed process: task=${taskId} pid=${entry.pid}`);
  } catch (err) {
    console.log(`[executor] Process already dead: task=${taskId} pid=${entry.pid} err=${err.message}`);
  }

  activeProcesses.delete(taskId);
  return true;
}

/**
 * Get snapshot of all active processes (for diagnostics)
 */
function getActiveProcesses() {
  const result = [];
  for (const [taskId, entry] of activeProcesses) {
    result.push({
      taskId,
      pid: entry.pid,
      runId: entry.runId,
      startedAt: entry.startedAt,
      alive: isProcessAlive(entry.pid),
    });
  }
  return result;
}

/**
 * Clean up orphan `claude -p /dev` processes not in our registry.
 * Called on startup to handle leftover processes from previous server runs.
 */
function cleanupOrphanProcesses() {
  try {
    const output = execSync(
      "ps aux | grep 'claude -p /dev' | grep -v grep | awk '{print $2}'",
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    if (!output) {
      console.log('[executor] No orphan claude processes found');
      return 0;
    }

    const pids = output.split('\n').map(p => parseInt(p, 10)).filter(p => !isNaN(p));
    const trackedPids = new Set([...activeProcesses.values()].map(e => e.pid));

    let killed = 0;
    for (const pid of pids) {
      if (!trackedPids.has(pid)) {
        try {
          process.kill(pid, 'SIGTERM');
          killed++;
          console.log(`[executor] Killed orphan process: pid=${pid}`);
        } catch {
          // already dead
        }
      }
    }

    console.log(`[executor] Orphan cleanup: found=${pids.length} killed=${killed} tracked=${trackedPids.size}`);
    return killed;
  } catch (err) {
    console.error('[executor] Orphan cleanup failed:', err.message);
    return 0;
  }
}

/**
 * Ensure prompt directory exists
 */
async function ensurePromptDir() {
  try {
    await mkdir(PROMPT_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error('[executor] Failed to create prompt dir:', err.message);
    }
  }
}

/**
 * Generate a unique run ID
 */
function generateRunId(taskId) {
  const timestamp = Date.now();
  return `run-${taskId.slice(0, 8)}-${timestamp}`;
}

/**
 * Prepare prompt content from task
 */
function preparePrompt(task) {
  if (task.prd_content) {
    return `/dev\n\n${task.prd_content}`;
  }
  if (task.payload?.prd_content) {
    return `/dev\n\n${task.payload.prd_content}`;
  }
  if (task.payload?.prd_path) {
    return `/dev ${task.payload.prd_path}`;
  }

  const prd = `# PRD - ${task.title}

## 背景
任务来自 Brain 自动调度。

## 功能描述
${task.description || task.title}

## 成功标准
- [ ] 任务完成
`;

  return `/dev\n\n${prd}`;
}

/**
 * Update task with run information
 */
async function updateTaskRunInfo(taskId, runId, status = 'triggered') {
  try {
    await pool.query(`
      UPDATE tasks
      SET
        payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object(
          'current_run_id', $2,
          'run_status', $3,
          'run_triggered_at', NOW()
        )
      WHERE id = $1
    `, [taskId, runId, status]);

    return { success: true };
  } catch (err) {
    console.error('[executor] Failed to update task run info:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger cecelia-run for a task.
 *
 * v2: Uses spawn() for PID tracking + task-level dedup.
 *
 * @param {Object} task - The task object from database
 * @returns {Object} - { success, runId, taskId, error?, reason? }
 */
async function triggerCeceliaRun(task) {
  try {
    // === DEDUP CHECK ===
    const existing = activeProcesses.get(task.id);
    if (existing && isProcessAlive(existing.pid)) {
      console.log(`[executor] Task ${task.id} already running (pid=${existing.pid}), skipping`);
      return {
        success: false,
        taskId: task.id,
        reason: 'already_running',
        existingPid: existing.pid,
        existingRunId: existing.runId,
      };
    }
    // Clean stale entry if process is dead
    if (existing) {
      activeProcesses.delete(task.id);
    }

    await ensurePromptDir();

    const runId = generateRunId(task.id);
    const promptFile = path.join(PROMPT_DIR, `${task.id}-${runId}.txt`);

    // 1. Prepare prompt content
    const promptContent = preparePrompt(task);

    // 2. Write prompt to file
    await writeFile(promptFile, promptContent, 'utf-8');
    console.log(`[executor] Prompt written to ${promptFile}`);

    // 3. Update task with run info before execution
    await updateTaskRunInfo(task.id, runId, 'triggered');

    // 4. Launch cecelia-run with spawn() for PID tracking
    const logFile = `/tmp/cecelia-${task.id}.log`;
    const webhookUrl = process.env.BRAIN_CALLBACK_URL || 'http://localhost:5212/api/brain/execution-callback';

    const child = spawn(CECELIA_RUN_PATH, [task.id, runId, promptFile], {
      cwd: WORK_DIR,
      env: {
        ...process.env,
        WEBHOOK_URL: webhookUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true, // Run in own process group for clean kill
    });

    // Don't let child keep parent alive
    child.unref();

    // Redirect stdout/stderr to log file (non-blocking)
    const fs = await import('fs');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    // Track the process
    activeProcesses.set(task.id, {
      pid: child.pid,
      startedAt: new Date().toISOString(),
      runId,
      process: child,
    });

    console.log(`[executor] Spawned pid=${child.pid} for task=${task.id} run=${runId}`);

    // Auto-remove from registry when process exits
    child.on('exit', (code, signal) => {
      console.log(`[executor] Process exited: task=${task.id} pid=${child.pid} code=${code} signal=${signal}`);
      activeProcesses.delete(task.id);
      logStream.end();
    });

    child.on('error', (err) => {
      console.error(`[executor] Process error: task=${task.id} pid=${child.pid} err=${err.message}`);
      activeProcesses.delete(task.id);
      logStream.end();
    });

    return {
      success: true,
      runId,
      taskId: task.id,
      pid: child.pid,
      promptFile,
      logFile,
    };

  } catch (err) {
    console.error(`[executor] Error triggering cecelia-run: ${err.message}`);
    return {
      success: false,
      taskId: task.id,
      error: err.message,
    };
  }
}

/**
 * Check if cecelia-run is available
 */
async function checkCeceliaRunAvailable() {
  try {
    execSync(`test -x "${CECELIA_RUN_PATH}"`, { timeout: 5000 });
    return { available: true, path: CECELIA_RUN_PATH };
  } catch {
    return { available: false, path: CECELIA_RUN_PATH, error: 'Not found or not executable' };
  }
}

/**
 * Get execution status for a task
 */
async function getTaskExecutionStatus(taskId) {
  try {
    const result = await pool.query(`
      SELECT
        payload->'current_run_id' as run_id,
        payload->'run_status' as run_status,
        payload->'run_triggered_at' as triggered_at,
        payload->'last_run_result' as last_result
      FROM tasks
      WHERE id = $1
    `, [taskId]);

    if (result.rows.length === 0) {
      return { found: false };
    }

    // Augment with live process info
    const processInfo = activeProcesses.get(taskId);
    return {
      found: true,
      ...result.rows[0],
      process_alive: processInfo ? isProcessAlive(processInfo.pid) : false,
      process_pid: processInfo?.pid || null,
    };
  } catch (err) {
    return { found: false, error: err.message };
  }
}

export {
  triggerCeceliaRun,
  checkCeceliaRunAvailable,
  getTaskExecutionStatus,
  updateTaskRunInfo,
  preparePrompt,
  generateRunId,
  // v2 additions
  getActiveProcessCount,
  getActiveProcesses,
  killProcess,
  cleanupOrphanProcesses,
  isProcessAlive,
};
