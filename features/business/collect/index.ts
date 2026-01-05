// Collect feature module
import { Router } from 'express';
import collectRoute from './collect.route';

export const router: Router = collectRoute;
export const basePath = '/v1/collect';  // Routes at /v1/collect/healthcheck, etc.
export const requiresAuth = true;

export { collectService } from './collect.service';
