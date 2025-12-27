// Auth feature module
import { Router } from 'express';
import authRoute from './auth.route';

export const router: Router = authRoute;
export const basePath = '/v1/accounts';  // Mounted under accounts path
export const requiresAuth = true;

export { authService } from './auth.service';
export * from './auth.types';
