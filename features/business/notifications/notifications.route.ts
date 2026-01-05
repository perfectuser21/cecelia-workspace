// Notification routes
import { Router, Request, Response, NextFunction } from 'express';
import { notificationsService } from './notifications.service';
import { AppError } from '../../../shared/middleware/error.middleware';

const router = Router();

// POST /login_required - Notify that login is required
router.post('/login_required', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform, accountId, reason, loginUrl } = req.body;

    if (!platform || !accountId || !reason || !loginUrl) {
      throw new AppError(
        'Missing required fields: platform, accountId, reason, loginUrl',
        400
      );
    }

    const result = await notificationsService.notifyLoginRequired({
      platform,
      accountId,
      reason,
      loginUrl,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /team_daily - Send daily team notification
router.post('/team_daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, summaryText, notionUrl } = req.body;

    if (!date || !summaryText) {
      throw new AppError('Missing required fields: date, summaryText', 400);
    }

    const result = await notificationsService.notifyTeamDaily({
      date,
      summaryText,
      notionUrl,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /ops_alert - Send operations alert
router.post('/ops_alert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { where, workflow, node, platform, accountId, error, meta } = req.body;

    if (!where || !workflow || !node || !platform || !accountId || !error) {
      throw new AppError(
        'Missing required fields: where, workflow, node, platform, accountId, error',
        400
      );
    }

    const result = await notificationsService.notifyOpsAlert({
      where,
      workflow,
      node,
      platform,
      accountId,
      error,
      meta,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
