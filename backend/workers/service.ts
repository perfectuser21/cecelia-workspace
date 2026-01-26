import * as fs from 'fs/promises';
import * as path from 'path';
import type { WorkersConfig, Worker, Department, WorkerWithWorkflows } from './types.js';

const CONFIG_FILE = path.resolve(process.cwd(), 'data/workers/workers.config.json');

let cachedConfig: WorkersConfig | null = null;

async function loadConfig(): Promise<WorkersConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config: WorkersConfig = JSON.parse(data);
    cachedConfig = config;
    return config;
  } catch (error) {
    throw new Error('Failed to load workers config: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export function reloadConfig(): void {
  cachedConfig = null;
}

export async function getAllWorkers(): Promise<Department[]> {
  const config = await loadConfig();
  return config.departments;
}

export async function getAllWorkersFlat(): Promise<Worker[]> {
  const config = await loadConfig();
  const workers: Worker[] = [];

  for (const dept of config.departments) {
    workers.push(...dept.workers);
  }

  return workers;
}

export async function getWorkerById(id: string): Promise<WorkerWithWorkflows | null> {
  const workers = await getAllWorkersFlat();
  const worker = workers.find((w) => w.id === id);

  if (!worker) {
    return null;
  }

  return {
    ...worker,
    matched_workflows: worker.n8n_workflows,
  };
}

export async function getWorkerWorkflows(id: string): Promise<string[]> {
  const worker = await getWorkerById(id);
  return worker?.n8n_workflows || [];
}

export async function findWorkerByWorkflow(workflowName: string): Promise<Worker | null> {
  const workers = await getAllWorkersFlat();

  let worker = workers.find((w) =>
    w.n8n_workflows.includes(workflowName)
  );

  if (!worker) {
    worker = workers.find((w) =>
      w.n8n_workflows.some((wf) => wf.includes(workflowName) || workflowName.includes(wf))
    );
  }

  return worker || null;
}

export async function getDepartmentById(id: string): Promise<Department | null> {
  const config = await loadConfig();
  return config.departments.find((d) => d.id === id) || null;
}

export async function searchWorkersBySkill(skill: string): Promise<Worker[]> {
  const workers = await getAllWorkersFlat();
  return workers.filter((w) =>
    w.skills.some((s) => s.toLowerCase().includes(skill.toLowerCase()))
  );
}
