// N8n Workflows feature module
import { Router } from 'express';
import n8nWorkflowsRoute from './n8n-workflows.route';

export const router: Router = n8nWorkflowsRoute;
export const basePath = '/v1/n8n-workflows';
export const requiresAuth = false; // Public access for dashboard

// Export service for cross-module dependencies
export { n8nWorkflowsService } from './n8n-workflows.service';

// Export types
export * from './n8n-workflows.types';
