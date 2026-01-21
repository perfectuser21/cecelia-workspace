import { Router } from 'express';
import route from './claude-stats.route';

export const router: Router = route;
export const basePath = '/v1/claude-stats';
export const requiresAuth = false; // Dashboard has its own auth (Feishu login)

export { service } from './claude-stats.service';
