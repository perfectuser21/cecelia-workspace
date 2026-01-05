// VPS Monitor feature module
import { Router } from 'express';
import vpsMonitorRoute from './vps-monitor.route';

export const router: Router = vpsMonitorRoute;
export const basePath = '/v1/vps-monitor';
export const requiresAuth = false; // Public access for monitoring dashboards

// Export service for cross-module dependencies
export { vpsMonitorService } from './vps-monitor.service';

// Export types
export * from './vps-monitor.types';
