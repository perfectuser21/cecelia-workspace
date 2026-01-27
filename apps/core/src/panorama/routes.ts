/**
 * Panorama REST API Routes
 * Base path: /api/panorama
 */

import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const router = Router();

// Dev runs directory for plan data
const DEV_RUNS_DIR = process.env.DEV_RUNS_DIR || join(process.env.HOME || '/home/xx', 'dev/.dev-runs');

interface VitalsData {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
  load: number[];
}

interface PlanItem {
  id: string;
  content: string;
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
}

interface PlanData {
  date: string;
  items: PlanItem[];
  source: string;
}

/**
 * Get system vitals using shell commands
 */
function getSystemVitals(): VitalsData {
  // CPU usage
  let cpuUsage = 0;
  let cpuCores = 1;
  try {
    const cpuInfo = execSync("grep -c ^processor /proc/cpuinfo", { encoding: 'utf-8' }).trim();
    cpuCores = parseInt(cpuInfo, 10) || 1;

    const loadAvg = execSync("cat /proc/loadavg", { encoding: 'utf-8' }).trim().split(' ');
    cpuUsage = (parseFloat(loadAvg[0]) / cpuCores) * 100;
  } catch {
    // Default values on error
  }

  // Memory info
  let memTotal = 0, memUsed = 0, memFree = 0, memPercent = 0;
  try {
    const memInfo = execSync("free -b", { encoding: 'utf-8' });
    const memLine = memInfo.split('\n')[1].split(/\s+/);
    memTotal = parseInt(memLine[1], 10);
    memUsed = parseInt(memLine[2], 10);
    memFree = parseInt(memLine[3], 10);
    memPercent = (memUsed / memTotal) * 100;
  } catch {
    // Default values on error
  }

  // Disk info
  let diskTotal = 0, diskUsed = 0, diskFree = 0, diskPercent = 0;
  try {
    const diskInfo = execSync("df -B1 /", { encoding: 'utf-8' });
    const diskLine = diskInfo.split('\n')[1].split(/\s+/);
    diskTotal = parseInt(diskLine[1], 10);
    diskUsed = parseInt(diskLine[2], 10);
    diskFree = parseInt(diskLine[3], 10);
    diskPercent = (diskUsed / diskTotal) * 100;
  } catch {
    // Default values on error
  }

  // Uptime
  let uptimeSeconds = 0;
  let uptimeFormatted = 'Unknown';
  try {
    const uptimeRaw = execSync("cat /proc/uptime", { encoding: 'utf-8' }).trim().split(' ')[0];
    uptimeSeconds = Math.floor(parseFloat(uptimeRaw));

    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    if (days > 0) {
      uptimeFormatted = `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      uptimeFormatted = `${hours}h ${minutes}m`;
    } else {
      uptimeFormatted = `${minutes}m`;
    }
  } catch {
    // Default values on error
  }

  // Load average
  let load: number[] = [0, 0, 0];
  try {
    const loadAvg = execSync("cat /proc/loadavg", { encoding: 'utf-8' }).trim().split(' ');
    load = [parseFloat(loadAvg[0]), parseFloat(loadAvg[1]), parseFloat(loadAvg[2])];
  } catch {
    // Default values on error
  }

  return {
    cpu: { usage: cpuUsage, cores: cpuCores },
    memory: { total: memTotal, used: memUsed, free: memFree, percent: memPercent },
    disk: { total: diskTotal, used: diskUsed, free: diskFree, percent: diskPercent },
    uptime: { seconds: uptimeSeconds, formatted: uptimeFormatted },
    load,
  };
}

/**
 * Parse .plan.md file to extract tasks
 */
function parsePlanFile(content: string): PlanItem[] {
  const items: PlanItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match markdown checkbox: - [ ] or - [x]
    const match = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/);
    if (match) {
      const completed = match[1].toLowerCase() === 'x';
      const text = match[2].trim();

      // Check for priority markers
      let priority: 'high' | 'medium' | 'low' | undefined;
      if (text.includes('[HIGH]') || text.includes('[!]')) {
        priority = 'high';
      } else if (text.includes('[LOW]')) {
        priority = 'low';
      }

      items.push({
        id: `plan-${items.length + 1}`,
        content: text.replace(/\[(HIGH|LOW|!)\]/g, '').trim(),
        completed,
        priority,
      });
    }
  }

  return items;
}

/**
 * Get today's plan from .plan.md or .dev-runs
 */
function getTodaysPlan(): PlanData {
  const today = new Date().toISOString().split('T')[0];
  const homeDir = process.env.HOME || '/home/xx';

  // Try .plan.md in home directory first
  const planPath = join(homeDir, '.plan.md');
  if (existsSync(planPath)) {
    try {
      const content = readFileSync(planPath, 'utf-8');
      const items = parsePlanFile(content);
      return {
        date: today,
        items,
        source: '.plan.md',
      };
    } catch {
      // Fall through to next source
    }
  }

  // Try .dev-runs directory
  const devRunsPlanPath = join(DEV_RUNS_DIR, 'plan.md');
  if (existsSync(devRunsPlanPath)) {
    try {
      const content = readFileSync(devRunsPlanPath, 'utf-8');
      const items = parsePlanFile(content);
      return {
        date: today,
        items,
        source: '.dev-runs/plan.md',
      };
    } catch {
      // Fall through to empty
    }
  }

  return {
    date: today,
    items: [],
    source: 'none',
  };
}

/**
 * GET /api/panorama/vitals
 * Get VPS system vitals
 */
router.get('/vitals', (_req: Request, res: Response) => {
  try {
    const vitals = getSystemVitals();
    return res.json({
      success: true,
      data: vitals,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /api/panorama/plan
 * Get today's plan
 */
router.get('/plan', (_req: Request, res: Response) => {
  try {
    const plan = getTodaysPlan();
    return res.json({
      success: true,
      data: plan,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /api/panorama/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
