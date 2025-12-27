// Main server application
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { db } from './shared/db/connection';
import config from './shared/utils/config';
import logger from './shared/utils/logger';
import { errorHandler, notFoundHandler } from './shared/middleware/error.middleware';
import { requestLogger } from './shared/middleware/logger.middleware';
import { loadFeatureModules } from './bootstrap';

class Server {
  private app: Application;

  constructor() {
    this.app = express();
  }

  async initialize(): Promise<void> {
    this.setupMiddleware();
    await this.setupFeatureModules();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());

    // CORS
    this.app.use(
      cors({
        origin: config.cors.origin,
        credentials: true,
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger);

    // Health check (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: db.getStatus(),
      });
    });

    // Public media files (for zenithjoyai.com to access uploaded images)
    this.app.use('/media', (req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      next();
    }, express.static('/app/data/uploads'));
  }

  private async setupFeatureModules(): Promise<void> {
    // Auto-load all feature modules from features/ directory
    await loadFeatureModules(this.app);
  }

  private setupErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  async start(): Promise<void> {
    try {
      await db.connect();
      logger.info('Database connected successfully');

      await this.initialize();

      // Start VPS metrics collection
      const { vpsMonitorService } = await import('./features/vps-monitor');
      vpsMonitorService.startMetricsCollection();

      const port = config.port;
      this.app.listen(port, '0.0.0.0', () => {
        logger.info(`Server started on port ${port}`, {
          nodeEnv: config.nodeEnv,
          port,
        });
      });
    } catch (error: any) {
      logger.error('Failed to start server', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop VPS metrics collection
      const { vpsMonitorService } = await import('./features/vps-monitor');
      vpsMonitorService.stopMetricsCollection();

      await db.close();
      logger.info('Server stopped');
    } catch (error: any) {
      logger.error('Error stopping server', { error: error.message });
    }
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await server.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await server.stop();
  process.exit(0);
});

// Start server
const server = new Server();
server.start();

export default Server;
