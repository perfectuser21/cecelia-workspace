// N8n Live Status feature module
import { Router } from 'express';
import n8nLiveStatusRoute from './n8n-live-status.route';

export const router: Router = n8nLiveStatusRoute;
export const basePath = '/v1/n8n-live-status';
export const requiresAuth = false; // Public access for dashboard

// Export service for cross-module dependencies
export { n8nLiveStatusService } from './n8n-live-status.service';

// Export types
export * from './n8n-live-status.types';
