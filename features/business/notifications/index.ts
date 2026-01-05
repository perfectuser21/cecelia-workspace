// Notifications feature module
import { Router } from 'express';
import notificationsRoute from './notifications.route';

export const router: Router = notificationsRoute;
export const basePath = '/v1/notify';
export const requiresAuth = true;

export { notificationsService } from './notifications.service';
export * from './notifications.types';
