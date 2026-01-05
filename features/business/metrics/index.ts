// Metrics feature module
import { Router } from 'express';
import metricsRoute from './metrics.route';

export const router: Router = metricsRoute;
export const basePath = '/v1/metrics';
export const requiresAuth = true;

export { metricService } from './metrics.service';
