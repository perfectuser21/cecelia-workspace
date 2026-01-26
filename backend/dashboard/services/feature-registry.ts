import * as fs from 'fs/promises';
import * as path from 'path';
import type { Feature, SubProject } from '../../shared/types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FEATURES_FILE = path.resolve(DATA_DIR, 'features.json');
const SUBPROJECTS_FILE = path.resolve(DATA_DIR, 'subprojects.json');

// Ensure data directory exists
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Directory already exists or created
  }
}

// ============ Helper Functions ============

function genFeatId(features: Feature[]): string {
  const maxId = features.reduce((max, f) => {
    const num = parseInt(f.id.substring(1), 10);
    return num > max ? num : max;
  }, 0);
  return `F${String(maxId + 1).padStart(3, '0')}`;
}

function genSubId(subprojects: SubProject[]): string {
  const maxId = subprojects.reduce((max, sp) => {
    const num = parseInt(sp.id.substring(3), 10);
    return num > max ? num : max;
  }, 0);
  return `SP-${String(maxId + 1).padStart(3, '0')}`;
}

async function readFeatures(): Promise<Feature[]> {
  try {
    const data = await fs.readFile(FEATURES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeFeatures(features: Feature[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(FEATURES_FILE, JSON.stringify(features, null, 2));
}

async function readSubProjects(): Promise<SubProject[]> {
  try {
    const data = await fs.readFile(SUBPROJECTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeSubProjects(subprojects: SubProject[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SUBPROJECTS_FILE, JSON.stringify(subprojects, null, 2));
}

// ============ Feature CRUD ============

export async function getAllFeatures(): Promise<Feature[]> {
  return readFeatures();
}

export async function getFeatureById(id: string): Promise<Feature | null> {
  const features = await readFeatures();
  return features.find((f) => f.id === id) || null;
}

export async function createFeature(input: {
  name: string;
  description: string;
  project?: string;
  status?: 'active' | 'deprecated';
}): Promise<Feature> {
  const features = await readFeatures();
  const id = genFeatId(features);
  const feature: Feature = {
    id,
    name: input.name,
    description: input.description,
    project: input.project || 'Cecelia-OS',
    status: input.status || 'active',
    created_at: new Date().toISOString(),
  };
  features.push(feature);
  await writeFeatures(features);
  return feature;
}

// ============ SubProject CRUD ============

export async function getAllSubProjects(): Promise<SubProject[]> {
  return readSubProjects();
}

export async function getSubProjectById(id: string): Promise<SubProject | null> {
  const subprojects = await readSubProjects();
  return subprojects.find((sp) => sp.id === id) || null;
}

export async function createSubProject(input: {
  feature_id: string;
  version: string;
  title: string;
  description?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'failed';
}): Promise<SubProject> {
  const subprojects = await readSubProjects();
  const id = genSubId(subprojects);
  const subproject: SubProject = {
    id,
    feature_id: input.feature_id,
    version: input.version,
    title: input.title,
    description: input.description,
    status: input.status || 'draft',
    created_at: new Date().toISOString(),
  };
  subprojects.push(subproject);
  await writeSubProjects(subprojects);
  return subproject;
}
