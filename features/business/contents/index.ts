// Contents feature module
import { Router } from 'express';
import contentsRoute from './contents.route';

export const router: Router = contentsRoute;
export const basePath = '/api/contents';
export const requiresAuth = false;  // Has mixed auth (public + admin endpoints)

export { contentsRepository } from './contents.repository';
