/**
 * Webhook 验证模块
 */

import { Router } from 'express';
import route from './webhook-validator.route';

export const router: Router = route;
export const basePath = '/api/webhook-validator';
export const requiresAuth = true;

export { WebhookValidatorService } from './webhook-validator.service';
export * from './webhook-validator.types';
