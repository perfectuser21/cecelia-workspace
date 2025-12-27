// Account management routes
import { Router, Request, Response, NextFunction } from 'express';
import { accountsService } from './accounts.service';
import { AppError } from '../../shared/middleware/error.middleware';

const router = Router();

// GET / - Get all accounts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.active === 'true';
    const accounts = await accountsService.getAllAccounts(activeOnly);

    res.json(
      accounts.map(account => accountsService.formatAccountForApi(account))
    );
  } catch (error) {
    next(error);
  }
});

// GET /stats/by-platform - Get account statistics (must be before /:id)
router.get('/stats/by-platform', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await accountsService.getAccountStatistics();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /:id - Get account by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid account ID', 400);
    }

    const account = await accountsService.getAccountById(id);
    res.json(accountsService.formatAccountForApi(account));
  } catch (error) {
    next(error);
  }
});

// POST / - Create new account
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform, accountId, displayName, ownerUserId } = req.body;

    if (!platform || !accountId || !displayName) {
      throw new AppError('Missing required fields: platform, accountId, displayName', 400);
    }

    const account = await accountsService.createAccount({
      platform,
      account_id: accountId,
      display_name: displayName,
      owner_user_id: ownerUserId,
    });

    res.status(201).json(accountsService.formatAccountForApi(account));
  } catch (error) {
    next(error);
  }
});

// PATCH /:id - Update account
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid account ID', 400);
    }

    const { displayName, isActive, ownerUserId } = req.body;

    const account = await accountsService.updateAccount(id, {
      display_name: displayName,
      is_active: isActive,
      owner_user_id: ownerUserId,
    });

    res.json(accountsService.formatAccountForApi(account));
  } catch (error) {
    next(error);
  }
});

// DELETE /:id - Delete account
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new AppError('Invalid account ID', 400);
    }

    await accountsService.deleteAccount(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
