/**
 * Notion API 重试测试 - API 路由
 */

import { Router, Request, Response } from 'express';
import { notionTestService } from './notion-test.service';
import logger from '../../shared/utils/logger';

const router = Router();

/**
 * POST /api/notion-test/run
 * 运行 Notion API 重试测试
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { runId, scenarios, notionApiKey } = req.body;

    logger.info('[NotionTestRoute] Received test request', {
      runId,
      scenariosCount: scenarios?.length,
    });

    const result = await notionTestService.runTest({
      runId,
      scenarios,
      notionApiKey,
    });

    res.json(result);
  } catch (error: any) {
    logger.error('[NotionTestRoute] Failed to run test', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/notion-test/report/:runId
 * 获取测试报告
 */
router.get('/report/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    logger.info('[NotionTestRoute] Fetching report', { runId });

    const report = await notionTestService.getReport(runId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logger.error('[NotionTestRoute] Failed to fetch report', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/notion-test/scenarios
 * 获取所有测试场景
 */
router.get('/scenarios', (req: Request, res: Response) => {
  try {
    const scenarios = notionTestService.getScenarios();

    res.json({
      success: true,
      data: scenarios,
    });
  } catch (error: any) {
    logger.error('[NotionTestRoute] Failed to fetch scenarios', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
