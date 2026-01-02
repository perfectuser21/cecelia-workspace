// Panorama API routes
import { Router, Request, Response } from 'express';
import { panoramaService } from './panorama.service';
import logger from '../../shared/utils/logger';

const router = Router();

/**
 * GET /v1/panorama
 * Get all panorama data
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await panoramaService.getAllData();
    res.json(data);
  } catch (error) {
    logger.error('Failed to get panorama data', { error });
    res.status(500).json({ error: 'Failed to get panorama data' });
  }
});

/**
 * GET /v1/panorama/layer/:id
 * Get specific layer data
 */
router.get('/layer/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await panoramaService.getAllData();

    if (!data.allData[id]) {
      res.status(404).json({ error: `Layer '${id}' not found` });
      return;
    }

    res.json({
      layer: data.allData[id],
      lastUpdated: data.lastUpdated,
    });
  } catch (error) {
    logger.error('Failed to get panorama layer', { error, layerId: req.params.id });
    res.status(500).json({ error: 'Failed to get panorama layer' });
  }
});

/**
 * POST /v1/panorama/refresh
 * Force refresh panorama cache
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const data = await panoramaService.refreshData();
    res.json({
      success: true,
      message: 'Panorama data refreshed',
      lastUpdated: data.lastUpdated,
    });
  } catch (error) {
    logger.error('Failed to refresh panorama data', { error });
    res.status(500).json({ error: 'Failed to refresh panorama data' });
  }
});

export default router;
