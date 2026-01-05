/**
 * Features Module Auto-Loader
 *
 * Automatically discovers and registers all feature modules from:
 * - features/business/* (12 customer-facing modules)
 * - features/core/* (7 internal/monitoring modules)
 */

import { Router, Express } from 'express';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import logger from '../shared/utils/logger';

interface FeatureModule {
  router: Router;
  basePath: string;
  requiresAuth?: boolean;
}

interface LoadedFeature {
  name: string;
  category: 'business' | 'core';
  basePath: string;
  requiresAuth: boolean;
}

const FEATURE_CATEGORIES = ['business', 'core'] as const;

/**
 * Load a single feature module
 */
async function loadFeatureModule(
  category: string,
  featureName: string
): Promise<FeatureModule | null> {
  const modulePath = join(__dirname, category, featureName);
  const indexPath = join(modulePath, 'index.ts');

  if (!existsSync(indexPath)) {
    logger.warn(`Feature ${category}/${featureName} missing index.ts, skipping`);
    return null;
  }

  try {
    const module = await import(join(modulePath, 'index'));

    if (!module.router || !module.basePath) {
      logger.warn(`Feature ${category}/${featureName} missing router or basePath export`);
      return null;
    }

    return {
      router: module.router,
      basePath: module.basePath,
      requiresAuth: module.requiresAuth ?? true
    };
  } catch (error) {
    logger.error(`Failed to load feature ${category}/${featureName}:`, error);
    return null;
  }
}

/**
 * Discover all features in a category directory
 */
function discoverFeatures(category: string): string[] {
  const categoryPath = join(__dirname, category);

  if (!existsSync(categoryPath)) {
    return [];
  }

  return readdirSync(categoryPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

/**
 * Register all features with the Express app
 */
export async function registerFeatures(
  app: Express,
  authMiddleware?: (req: any, res: any, next: any) => void
): Promise<LoadedFeature[]> {
  const loadedFeatures: LoadedFeature[] = [];

  for (const category of FEATURE_CATEGORIES) {
    const featureNames = discoverFeatures(category);

    for (const featureName of featureNames) {
      const module = await loadFeatureModule(category, featureName);

      if (module) {
        // Apply auth middleware if required and provided
        if (module.requiresAuth && authMiddleware) {
          app.use(module.basePath, authMiddleware, module.router);
        } else {
          app.use(module.basePath, module.router);
        }

        loadedFeatures.push({
          name: featureName,
          category: category as 'business' | 'core',
          basePath: module.basePath,
          requiresAuth: module.requiresAuth ?? true
        });

        logger.info(`✓ Loaded feature: ${category}/${featureName} → ${module.basePath}`);
      }
    }
  }

  logger.info(`Total features loaded: ${loadedFeatures.length}`);
  return loadedFeatures;
}

/**
 * Get list of all available features without loading them
 */
export function listFeatures(): { category: string; features: string[] }[] {
  return FEATURE_CATEGORIES.map(category => ({
    category,
    features: discoverFeatures(category)
  }));
}

// Export business features for direct import
export * as accounts from './business/accounts';
export * as auth from './business/auth';
export * as collect from './business/collect';
export * as contents from './business/contents';
export * as douyin from './business/douyin';
export * as logs from './business/logs';
export * as metrics from './business/metrics';
export * as notifications from './business/notifications';
export * as platformData from './business/platform-data';
export * as publish from './business/publish';
export * as session from './business/session';
export * as webhookValidator from './business/webhook-validator';

// Export core features for direct import
export * as aiFactory from './core/ai-factory';
export * as claudeMonitor from './core/claude-monitor';
export * as claudeStats from './core/claude-stats';
export * as n8nWorkflows from './core/n8n-workflows';
export * as panorama from './core/panorama';
export * as tasks from './core/tasks';
export * as vpsMonitor from './core/vps-monitor';
export * as workflowTracker from './core/workflow-tracker';
