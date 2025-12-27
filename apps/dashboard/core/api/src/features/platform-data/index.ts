// Platform Data feature module
import { Router } from 'express';
import platformDataRoute from './platform-data.route';

export const router: Router = platformDataRoute;
export const basePath = '/api/platform-data';
export const requiresAuth = false;
