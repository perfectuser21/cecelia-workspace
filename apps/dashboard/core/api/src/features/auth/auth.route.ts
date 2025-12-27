// Login flow routes
import { Router, Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { AppError } from '../../shared/middleware/error.middleware';
import { Platform } from '../../shared/types';

const router = Router();

// POST /:id/start-login - Start login flow
router.post('/:id/start-login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform, accountId } = req.body;

    if (!platform || !accountId) {
      throw new AppError('Missing required fields: platform, accountId', 400);
    }

    const result = await authService.startLogin(platform as Platform, accountId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /:id/login-status - Check login status
router.get('/:id/login-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
      throw new AppError('Missing required query parameter: sessionId', 400);
    }

    const status = await authService.getLoginStatus(sessionId);

    res.json(status);
  } catch (error) {
    next(error);
  }
});

// POST /:id/save-session - Save session state
router.post('/:id/save-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, storageState } = req.body;

    if (!sessionId || !storageState) {
      throw new AppError('Missing required fields: sessionId, storageState', 400);
    }

    await authService.saveSession(sessionId, storageState);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
