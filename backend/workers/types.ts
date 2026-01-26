/**
 * Worker Types for Unified Workers API
 */

export interface Worker {
  id: string;
  name: string;
  role: string;
  department: string;
  skills: string[];
  n8n_workflows: string[];
  description?: string;
  status?: 'active' | 'inactive';
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  workers: Worker[];
}

export interface WorkersConfig {
  version: string;
  departments: Department[];
}

export interface WorkerWithWorkflows extends Worker {
  matched_workflows?: string[];
}
