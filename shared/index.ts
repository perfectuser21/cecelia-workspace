// Shared module exports
// Unified entry point for all shared utilities, middleware, types, and configurations

// Database
export { db } from './db/connection';

// Middleware
export { authMiddleware, AuthenticatedRequest } from './middleware/auth.middleware';
export { errorHandler, notFoundHandler, AppError } from './middleware/error.middleware';
export { requestLogger } from './middleware/logger.middleware';

// Utils
export { config } from './utils/config';
export { logger } from './utils/logger';

// Types
export type {
  Platform,
  Account,
  Metric,
  DailyReport,
  Log,
  CollectDailyRequest,
  CollectDailyResponse,
  HealthCheckRequest,
  HealthCheckResponse,
  LoginSession,
  ApiError,
  StartLoginResponse,
  LoginStatusResponse,
  SaveSessionRequest,
  StoreMetricsRequest,
  StoreMetricsResponse,
  NotifyLoginRequiredRequest,
  NotifyLoginRequiredResponse,
  NotifyTeamDailyRequest,
  NotifyTeamDailyResponse,
  NotifyOpsAlertRequest,
  NotifyOpsAlertResponse,
  CreateLogRequest,
  CreateLogResponse,
  WorkflowConfig,
} from './types';

// Config
export {
  platformSpecs,
  getPlatformSpec,
  getAllPlatforms,
  PlatformSpec,
} from './config/platforms.config';
