// Session feature module
import { Router } from 'express';
import sessionRoute from './session.route';

export const router: Router = sessionRoute;
export const basePath = '/api/session';
export const requiresAuth = false;
