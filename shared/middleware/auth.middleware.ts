// Authentication middleware
import { Request, Response, NextFunction } from 'express';
import config from '../utils/config';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('Missing authorization header', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      error: 'Invalid API key',
    });
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  if (token !== config.apiKey) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      error: 'Invalid API key',
    });
    return;
  }

  req.apiKey = token;
  next();
};
