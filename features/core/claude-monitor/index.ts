// Claude Monitor feature module
import { Router } from 'express';
import claudeMonitorRoute from './claude-monitor.route';

export const router: Router = claudeMonitorRoute;
export const basePath = '/v1/claude-monitor';
export const requiresAuth = false; // No auth required for hooks to access

// Export service for cross-module dependencies
export { claudeMonitorService } from './claude-monitor.service';
export { claudeMonitorRepository } from './claude-monitor.repository';

// Export types
export * from './claude-monitor.types';
