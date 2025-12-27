// Publish feature module
import { Router } from 'express';
import publishRoute from './publish.route';

export const router: Router = publishRoute;
export const basePath = '/v1/publish';
export const requiresAuth = true;

export { publishService } from './publish.service';
