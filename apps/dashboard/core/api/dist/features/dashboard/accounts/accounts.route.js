"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Account management routes
const express_1 = require("express");
const accounts_service_1 = require("./accounts.service");
const error_middleware_1 = require("../../../shared/middleware/error.middleware");
const router = (0, express_1.Router)();
// GET / - Get all accounts
router.get('/', async (req, res, next) => {
    try {
        const activeOnly = req.query.active === 'true';
        const accounts = await accounts_service_1.accountsService.getAllAccounts(activeOnly);
        res.json(accounts.map(account => accounts_service_1.accountsService.formatAccountForApi(account)));
    }
    catch (error) {
        next(error);
    }
});
// GET /stats/by-platform - Get account statistics (must be before /:id)
router.get('/stats/by-platform', async (req, res, next) => {
    try {
        const stats = await accounts_service_1.accountsService.getAccountStatistics();
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
});
// GET /:id - Get account by ID
router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            throw new error_middleware_1.AppError('Invalid account ID', 400);
        }
        const account = await accounts_service_1.accountsService.getAccountById(id);
        res.json(accounts_service_1.accountsService.formatAccountForApi(account));
    }
    catch (error) {
        next(error);
    }
});
// POST / - Create new account
router.post('/', async (req, res, next) => {
    try {
        const { platform, accountId, displayName, ownerUserId } = req.body;
        if (!platform || !accountId || !displayName) {
            throw new error_middleware_1.AppError('Missing required fields: platform, accountId, displayName', 400);
        }
        const account = await accounts_service_1.accountsService.createAccount({
            platform,
            account_id: accountId,
            display_name: displayName,
            owner_user_id: ownerUserId,
        });
        res.status(201).json(accounts_service_1.accountsService.formatAccountForApi(account));
    }
    catch (error) {
        next(error);
    }
});
// PATCH /:id - Update account
router.patch('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            throw new error_middleware_1.AppError('Invalid account ID', 400);
        }
        const { displayName, isActive, ownerUserId } = req.body;
        const account = await accounts_service_1.accountsService.updateAccount(id, {
            display_name: displayName,
            is_active: isActive,
            owner_user_id: ownerUserId,
        });
        res.json(accounts_service_1.accountsService.formatAccountForApi(account));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /:id - Delete account
router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            throw new error_middleware_1.AppError('Invalid account ID', 400);
        }
        await accounts_service_1.accountsService.deleteAccount(id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=accounts.route.js.map