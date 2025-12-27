// Feature module auto-loader
import { Application, Router } from 'express';
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import logger from './shared/utils/logger';
import { authMiddleware } from './shared/middleware/auth.middleware';

export interface FeatureModule {
  router: Router;
  basePath: string;
  requiresAuth?: boolean;
}

export async function loadFeatureModules(app: Application): Promise<void> {
  const featuresDir = path.join(__dirname, 'features');

  // Skip if features directory doesn't exist yet
  if (!existsSync(featuresDir)) {
    logger.info('No features directory found, skipping feature module loading');
    return;
  }

  const featureDirs = readdirSync(featuresDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const featureName of featureDirs) {
    const indexPath = path.join(featuresDir, featureName, 'index');

    try {
      // Dynamic import the module
      const featureModule: FeatureModule = await import(indexPath);

      if (!featureModule.router || !featureModule.basePath) {
        logger.warn(`Feature ${featureName} missing router or basePath, skipping`);
        continue;
      }

      // Apply auth middleware if required
      if (featureModule.requiresAuth) {
        app.use(featureModule.basePath, authMiddleware, featureModule.router);
      } else {
        app.use(featureModule.basePath, featureModule.router);
      }

      logger.info(`Loaded feature module: ${featureName}`, {
        basePath: featureModule.basePath,
        requiresAuth: featureModule.requiresAuth ?? false,
      });
    } catch (error: any) {
      logger.error(`Failed to load feature ${featureName}`, {
        error: error.message,
      });
    }
  }
}
