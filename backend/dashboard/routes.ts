/**
 * Dashboard REST API Routes
 * Base path: /api/cecelia
 */

import { Router, Request, Response } from 'express';
import { taskTracker, taskEvents } from './services/task-tracker.js';
import * as featureRegistry from './services/feature-registry.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Extract error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error occurred';
}
import type {
  CreateRunRequest,
  UpdateCheckpointRequest,
  CreateRunResponse,
  UpdateCheckpointResponse,
  GetRunResponse,
  GetOverviewResponse,
  ErrorResponse,
} from './types.js';

const router = Router();

/**
 * POST /api/cecelia/runs
 * Create a new task run
 */
router.post('/runs', (req: Request, res: Response) => {
  try {
    const body = req.body as CreateRunRequest;

    if (!body.prd_path || !body.project || !body.feature_branch || !body.total_checkpoints) {
      const error: ErrorResponse = {
        success: false,
        error: 'Missing required fields: prd_path, project, feature_branch, total_checkpoints',
      };
      return res.status(400).json(error);
    }

    const run = taskTracker.createRun(body);

    const response: CreateRunResponse = {
      success: true,
      run_id: run.id,
      run,
    };

    return res.status(201).json(response);
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/cecelia/runs/:id
 * Get run details with checkpoints
 */
router.get('/runs/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const run = taskTracker.getRun(id);

    if (!run) {
      const error: ErrorResponse = {
        success: false,
        error: `Run not found: ${id}`,
      };
      return res.status(404).json(error);
    }

    const checkpoints = taskTracker.getCheckpoints(id);

    const response: GetRunResponse = {
      success: true,
      run,
      checkpoints,
    };

    return res.json(response);
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * PATCH /api/cecelia/runs/:runId/checkpoints/:checkpointId
 * Update checkpoint status
 */
router.patch('/runs/:runId/checkpoints/:checkpointId', (req: Request, res: Response) => {
  try {
    const { runId, checkpointId } = req.params;
    const body = req.body as UpdateCheckpointRequest;

    if (!body.status) {
      const error: ErrorResponse = {
        success: false,
        error: 'Missing required field: status',
      };
      return res.status(400).json(error);
    }

    const run = taskTracker.getRun(runId);
    if (!run) {
      const error: ErrorResponse = {
        success: false,
        error: `Run not found: ${runId}`,
      };
      return res.status(404).json(error);
    }

    const checkpoint = taskTracker.updateCheckpoint(runId, checkpointId, body);

    if (!checkpoint) {
      const error: ErrorResponse = {
        success: false,
        error: `Failed to update checkpoint: ${checkpointId}`,
      };
      return res.status(500).json(error);
    }

    const response: UpdateCheckpointResponse = {
      success: true,
      checkpoint,
    };

    return res.json(response);
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * PATCH /api/cecelia/checkpoints/:checkpointId
 * Update checkpoint status (alternative endpoint for Cecelia callback)
 * Note: Requires run_id in body or query
 */
router.patch('/checkpoints/:checkpointId', (req: Request, res: Response) => {
  try {
    const { checkpointId } = req.params;
    const runId = (req.body.run_id || req.query.run_id) as string;
    const body = req.body as UpdateCheckpointRequest;

    if (!runId) {
      const error: ErrorResponse = {
        success: false,
        error: 'Missing required field: run_id',
      };
      return res.status(400).json(error);
    }

    if (!body.status) {
      const error: ErrorResponse = {
        success: false,
        error: 'Missing required field: status',
      };
      return res.status(400).json(error);
    }

    const checkpoint = taskTracker.updateCheckpoint(runId, checkpointId, body);

    if (!checkpoint) {
      const error: ErrorResponse = {
        success: false,
        error: `Failed to update checkpoint: ${checkpointId}`,
      };
      return res.status(500).json(error);
    }

    const response: UpdateCheckpointResponse = {
      success: true,
      checkpoint,
    };

    return res.json(response);
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/cecelia/overview
 * Get dashboard overview
 */
router.get('/overview', (req: Request, res: Response) => {
  try {
    const MAX_LIMIT = 100;
    const rawLimit = parseInt(req.query.limit as string, 10) || 10;
    const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT); // Clamp between 1 and 100
    const overview = taskTracker.getOverview(limit);

    const response: GetOverviewResponse = {
      success: true,
      ...overview,
    };

    return res.json(response);
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * PATCH /api/cecelia/runs/:id/status
 * Update run's realtime status (current action, step, etc.)
 */
router.patch('/runs/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { current_action, current_step, step_status, pr_url } = req.body;

    const run = taskTracker.updateRunStatus(id, {
      current_action,
      current_step,
      step_status,
      pr_url,
    });

    if (!run) {
      const error: ErrorResponse = {
        success: false,
        error: `Run not found: ${id}`,
      };
      return res.status(404).json(error);
    }

    return res.json({
      success: true,
      run,
    });
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/cecelia/runs
 * Get all runs (for task list)
 */
router.get('/runs', (_req: Request, res: Response) => {
  try {
    const overview = taskTracker.getOverview(100);
    return res.json({
      success: true,
      runs: overview.recent_runs || [],
      total: overview.total_runs || 0,
    });
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/cecelia/tasks
 * Create a task via voice command (simplified interface)
 */
router.post('/tasks', (req: Request, res: Response) => {
  try {
    const { title, description, project = 'zenithjoy-core' } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, description',
      });
    }

    // 创建一个简化的任务（由语音命令触发）
    const run = taskTracker.createRun({
      prd_path: `.prd-${Date.now()}.md`,
      project,
      feature_branch: `cp-voice-${title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`,
      total_checkpoints: 8,
    });

    // 更新 run 的描述信息
    taskTracker.updateRunStatus(run.id, {
      current_action: `任务: ${title}`,
    });

    return res.status(201).json({
      success: true,
      task: {
        id: run.id,
        title,
        description,
        project,
        branch: run.feature_branch,
        status: run.status,
        created_at: run.started_at,
      },
    });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/cecelia/stream
 * SSE event stream for real-time updates
 */
// SSE clients storage
const sseClients: Set<Response> = new Set();

// Broadcast event to all SSE clients
export function broadcastSSE(event: { type: string; data: unknown }) {
  const message = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    client.write(message);
  }
}

router.get('/stream', (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // For nginx proxy
  res.flushHeaders();

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Add to clients set
  sseClients.add(res);
  console.log(`SSE client connected, total: ${sseClients.size}`);

  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    console.log(`SSE client disconnected, total: ${sseClients.size}`);
  });
});

/**
 * GET /api/cecelia/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    sse_clients: sseClients.size,
  });
});

/**
 * POST /api/cecelia/realtime-token
 * Get ephemeral token for OpenAI Realtime API
 */
router.post('/realtime-token', async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY not configured',
      });
    }

    // 直接调用 OpenAI API 获取 ephemeral token
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'shimmer',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return res.status(500).json({
        success: false,
        error: `OpenAI API error: ${response.status}`,
      });
    }

    const data = await response.json() as { client_secret?: { value: string; expires_at: number } };

    if (!data.client_secret?.value) {
      return res.status(500).json({
        success: false,
        error: 'No client_secret in response',
      });
    }

    return res.json({
      success: true,
      token: data.client_secret.value,
      expires_at: data.client_secret.expires_at,
    });
  } catch (error: unknown) {
    console.error('Realtime token error:', error);
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * POST /api/cecelia/realtime-sdp
 * Server-side SDP exchange with OpenAI Realtime API
 */
router.post('/realtime-sdp', async (req: Request, res: Response) => {
  console.log('[SDP] Request received');
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY not configured',
      });
    }

    const { sdp, model = 'gpt-4o-realtime-preview-2024-12-17' } = req.body as { sdp: string; model?: string };

    if (!sdp) {
      return res.status(400).json({
        success: false,
        error: 'SDP is required',
      });
    }

    // Call OpenAI Realtime API with SDP
    console.log('[SDP] Calling OpenAI with model:', model);
    const response = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/sdp',
      },
      body: sdp,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI SDP exchange error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        error: `OpenAI error: ${response.status} - ${errorText}`,
      });
    }

    const answerSdp = await response.text();
    return res.json({
      success: true,
      sdp: answerSdp,
    });
  } catch (error: unknown) {
    console.error('SDP exchange error:', error);
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

// Connect task events to SSE broadcasts
taskEvents.on('task_created', (event) => broadcastSSE(event));
taskEvents.on('task_updated', (event) => broadcastSSE(event));
taskEvents.on('checkpoint_updated', (event) => broadcastSSE(event));

/**
 * GET /api/cecelia/projects
 * Get list of projects with their info and features
 */
router.get('/projects', (_req: Request, res: Response) => {
  try {
    const DEV_DIR = '/home/xx/dev';
    const PROJECT_PREFIXES = ['zenithjoy-'];

    // Get project directories
    const dirs = fs.readdirSync(DEV_DIR).filter(name => {
      const fullPath = path.join(DEV_DIR, name);
      if (!fs.statSync(fullPath).isDirectory()) return false;
      return PROJECT_PREFIXES.some(prefix => name.startsWith(prefix));
    });

    const projects = dirs.map(name => {
      const projectPath = path.join(DEV_DIR, name);

      // Read README.md for description
      let description = '';
      const readmePath = path.join(projectPath, 'README.md');
      if (fs.existsSync(readmePath)) {
        const content = fs.readFileSync(readmePath, 'utf-8');
        // Get first paragraph after title
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && !line.startsWith('#') && !line.startsWith('```')) {
            description = line;
            break;
          }
        }
      }

      // Scan features/ directory
      const features: Array<{ id: string; name: string; version: string; routes: number }> = [];
      const featuresDir = path.join(projectPath, 'features');
      if (fs.existsSync(featuresDir)) {
        const featureDirs = fs.readdirSync(featuresDir).filter(f => {
          const fPath = path.join(featuresDir, f);
          return fs.statSync(fPath).isDirectory() && f !== 'shared' && f !== 'types.ts';
        });

        for (const featureDir of featureDirs) {
          const indexPath = path.join(featuresDir, featureDir, 'index.ts');
          if (fs.existsSync(indexPath)) {
            // Parse manifest from index.ts
            const indexContent = fs.readFileSync(indexPath, 'utf-8');

            // Extract id, name, version using regex
            const idMatch = indexContent.match(/id:\s*['"]([^'"]+)['"]/);
            const nameMatch = indexContent.match(/name:\s*['"]([^'"]+)['"]/);
            const versionMatch = indexContent.match(/version:\s*['"]([^'"]+)['"]/);
            const routesMatch = indexContent.match(/routes:\s*\[([^\]]*)\]/s);

            features.push({
              id: idMatch?.[1] || featureDir,
              name: nameMatch?.[1] || featureDir,
              version: versionMatch?.[1] || '1.0.0',
              routes: routesMatch ? (routesMatch[1].match(/path:/g) || []).length : 0,
            });
          }
        }
      }

      return {
        name,
        path: projectPath,
        description,
        features,
      };
    });

    return res.json({
      success: true,
      projects,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

// ============================================
// VPS Data Access APIs (Phase 2)
// ============================================

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fsPromises from 'fs/promises';

const execAsync = promisify(exec);

/**
 * GET /api/cecelia/vps/workflows
 * Get N8N workflow summary
 */
router.get('/vps/workflows', async (_req: Request, res: Response) => {
  try {
    const n8nUrl = 'http://localhost:5678/api/v1/workflows';
    const response = await fetch(n8nUrl, {
      headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY || '' }
    });

    if (!response.ok) {
      throw new Error(`N8N API error: ${response.status}`);
    }

    const data = await response.json() as { data: Array<{ id: string; name: string; active: boolean; createdAt: string }> };
    const workflows = data.data.map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      created_at: w.createdAt,
    }));

    return res.json({ success: true, workflows, total: workflows.length });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/cecelia/vps/git-status
 * Get git status for a project
 */
router.get('/vps/git-status', async (req: Request, res: Response) => {
  try {
    const project = (req.query.project as string) || 'zenithjoy-core';
    const projectPath = `/home/xx/dev/${project}`;

    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    const { stdout: status } = await execAsync('git status --short', { cwd: projectPath });
    const { stdout: log } = await execAsync('git log --oneline -5', { cwd: projectPath });

    return res.json({
      success: true,
      project,
      branch: branch.trim(),
      changes: status.trim().split('\n').filter(Boolean),
      recent_commits: log.trim().split('\n').filter(Boolean),
    });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * POST /api/cecelia/vps/search
 * Search code in projects (uses grep as fallback if rg not available)
 */
router.post('/vps/search', async (req: Request, res: Response) => {
  try {
    const { query, project = 'zenithjoy-core', file_pattern = '*.ts' } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Missing query parameter' });
    }

    const projectPath = `/home/xx/dev/${project}`;
    const escapedQuery = query.replace(/'/g, "'\\''");

    // Use find + grep directly (works in both Linux and BusyBox)
    const grepCmd = `find . -name '${file_pattern}' -type f -exec grep -Hn '${escapedQuery}' {} \\; 2>/dev/null | head -50`;
    const { stdout: grepOut } = await execAsync(grepCmd, { cwd: projectPath, maxBuffer: 1024 * 1024 });

    const results: Array<{ file: string; line: number; text: string }> = [];
    for (const line of grepOut.trim().split('\n').filter(Boolean)) {
      const match = line.match(/^\.\/(.+?):(\d+):(.*)$/);
      if (match) {
        results.push({
          file: match[1],
          line: parseInt(match[2], 10),
          text: match[3].trim(),
        });
      }
    }
    return res.json({ success: true, results, total: results.length });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: getErrorMessage(error), results: [] });
  }
});

/**
 * POST /api/cecelia/vps/file
 * Read file content
 */
router.post('/vps/file', async (req: Request, res: Response) => {
  try {
    const { path: filePath, project = 'zenithjoy-core' } = req.body;

    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Missing path parameter' });
    }

    const fullPath = filePath.startsWith('/home/xx/dev/')
      ? filePath
      : path.join('/home/xx/dev', project, filePath);

    if (!fullPath.startsWith('/home/xx/dev/')) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const content = await fsPromises.readFile(fullPath, 'utf-8');

    return res.json({
      success: true,
      path: fullPath,
      content: content.slice(0, 10000),
      truncated: content.length > 10000,
    });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

/**
 * GET /api/cecelia/vps/docker
 * Get docker container status
 */
router.get('/vps/docker', async (_req: Request, res: Response) => {
  try {
    const { stdout } = await execAsync('docker ps --format "{{.Names}}|{{.Status}}|{{.Ports}}"');
    const containers = stdout.trim().split('\n').filter(Boolean).map((line) => {
      const [name, status, ports] = line.split('|');
      return { name, status, ports };
    });

    return res.json({ success: true, containers, total: containers.length });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});
/**
 * GET /api/cecelia/hierarchy
 * Get runs organized by Feature u2192 SubProject u2192 Run hierarchy
 */
router.get('/hierarchy', (req: Request, res: Response) => {
  try {
    const overview = taskTracker.getOverview(100);
    const runs = overview.recent_runs;

    interface HierarchySubProject {
      id: string;
      name: string;
      runs: typeof runs;
    }

    interface HierarchyFeature {
      id: string;
      name: string;
      subprojects: HierarchySubProject[];
    }

    const featureMap = new Map<string, HierarchyFeature>();

    for (const run of runs) {
      const featureId = run.feature_id || 'unassigned';
      const subprojectId = run.subproject_id || 'default';

      if (!featureMap.has(featureId)) {
        featureMap.set(featureId, {
          id: featureId,
          name: featureId === 'unassigned' ? 'Unassigned Runs' : featureId,
          subprojects: [],
        });
      }

      const feature = featureMap.get(featureId)!;
      let subproject = feature.subprojects.find((sp) => sp.id === subprojectId);

      if (!subproject) {
        subproject = {
          id: subprojectId,
          name: subprojectId === 'default' ? 'Default' : subprojectId,
          runs: [],
        };
        feature.subprojects.push(subproject);
      }

      subproject.runs.push(run);
    }

    const hierarchy = Array.from(featureMap.values());

    return res.json({
      success: true,
      hierarchy,
      total_features: hierarchy.length,
      total_runs: runs.length,
    });
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

// ============================================================
// Feature Registry API
// ============================================================

/**
 * GET /api/cecelia/features
 * List all features
 */
router.get('/features', async (_req: Request, res: Response) => {
  try {
    const features = await featureRegistry.getAllFeatures();
    return res.json({
      success: true,
      features,
      total: features.length,
    });
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/cecelia/features
 * Create a new feature
 */
router.post('/features', async (req: Request, res: Response) => {
  try {
    const { name, description, project, status } = req.body;
    if (!name || !description) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Missing required fields: name, description',
      };
      return res.status(400).json(errorResponse);
    }
    const feature = await featureRegistry.createFeature({ name, description, project, status });
    return res.status(201).json({
      success: true,
      feature,
    });
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/cecelia/features/:id
 * Get feature by ID
 */
router.get('/features/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const feature = await featureRegistry.getFeatureById(id);
    if (!feature) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: `Feature ${id} not found`,
      };
      return res.status(404).json(errorResponse);
    }
    return res.json({
      success: true,
      feature,
    });
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/cecelia/subprojects
 * List all subprojects
 */
router.get('/subprojects', async (_req: Request, res: Response) => {
  try {
    const subprojects = await featureRegistry.getAllSubProjects();
    return res.json({
      success: true,
      subprojects,
      total: subprojects.length,
    });
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/cecelia/subprojects
 * Create a new subproject
 */
router.post('/subprojects', async (req: Request, res: Response) => {
  try {
    const { feature_id, version, title, description, status } = req.body;
    if (!feature_id || !version || !title) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Missing required fields: feature_id, version, title',
      };
      return res.status(400).json(errorResponse);
    }
    const subproject = await featureRegistry.createSubProject({ feature_id, version, title, description, status });
    return res.status(201).json({
      success: true,
      subproject,
    });
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/cecelia/subprojects/:id
 * Get subproject by ID
 */
router.get('/subprojects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const subproject = await featureRegistry.getSubProjectById(id);
    if (!subproject) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: `SubProject ${id} not found`,
      };
      return res.status(404).json(errorResponse);
    }
    return res.json({
      success: true,
      subproject,
    });
  } catch (error: unknown) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: getErrorMessage(error),
    };
    return res.status(500).json(errorResponse);
  }
});


export default router;
