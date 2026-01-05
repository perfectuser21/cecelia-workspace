// Workflow Tracker feature module
import { Router } from 'express';
import workflowTrackerRoute from './workflow-tracker.route';

export const router: Router = workflowTrackerRoute;
export const basePath = '/v1/workflow-tracker';
export const requiresAuth = false; // No auth required for executor to send events

// Export service for cross-module dependencies
export { workflowTrackerService } from './workflow-tracker.service';
export { workflowTrackerRepository } from './workflow-tracker.repository';

// Export types
export * from './workflow-tracker.types';
