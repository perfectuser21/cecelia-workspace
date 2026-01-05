// Accounts feature module
import { Router } from 'express';
import accountsRoute from './accounts.route';

export const router: Router = accountsRoute;
export const basePath = '/v1/accounts';
export const requiresAuth = true;

// Export service for cross-module dependencies
export { accountsService } from './accounts.service';
export { accountsRepository } from './accounts.repository';

// Export types
export * from './accounts.types';
