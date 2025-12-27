import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { accountsRouter } from './routes/accounts';
import { healthcheckRouter } from './routes/healthcheck';
import { collectRouter } from './routes/collect';
import { storeRouter } from './routes/store';
import { reportRouter } from './routes/report';
import { notifyRouter } from './routes/notify';
import { logsRouter } from './routes/logs';
import { douyinRouter } from './routes/douyin';
import { contentsRouter } from './routes/contents';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API Key Authentication Middleware
const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.COLLECTOR_API_KEY;

  if (!expectedKey) {
    console.warn('Warning: COLLECTOR_API_KEY not set in environment');
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7);
  if (token !== expectedKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Douyin login API (no auth required for frontend access)
app.use('/api/douyin', douyinRouter);

// Contents API (no auth for frontend, POST needs key for n8n)
app.use('/api/contents', contentsRouter);

// API Routes (with authentication)
app.use('/v1/accounts', authenticateApiKey, accountsRouter);
app.use('/v1/healthcheck', authenticateApiKey, healthcheckRouter);
app.use('/v1/collect_daily', authenticateApiKey, collectRouter);
app.use('/v1/store_metrics', authenticateApiKey, storeRouter);
app.use('/v1/report_daily', authenticateApiKey, reportRouter);
app.use('/v1/notify', authenticateApiKey, notifyRouter);
app.use('/v1/logs', authenticateApiKey, logsRouter);

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(port, () => {
  console.log(`\n🚀 Collector API server running on port ${port}`);
  console.log(`📡 Base URL: http://localhost:${port}`);
  console.log(`💚 Health: http://localhost:${port}/health\n`);
});

export default app;
