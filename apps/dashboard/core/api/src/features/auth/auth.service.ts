// Login service for managing platform login flows
import { v4 as uuidv4 } from 'uuid';
import { Platform } from '../../shared/types';
import { AppError } from '../../shared/middleware/error.middleware';
import logger from '../../shared/utils/logger';
import { accountsService } from '../accounts';
import { LoginSession, StartLoginResponse, LoginStatusResponse } from './auth.types';

// In-memory session store (could be Redis in production)
const loginSessions = new Map<string, LoginSession>();

class AuthService {
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  async startLogin(platform: Platform, accountId: string): Promise<StartLoginResponse> {
    // Verify account exists
    await accountsService.getAccountByPlatformAndId(platform, accountId);

    const sessionId = `${platform}-${accountId}-${uuidv4()}`;
    const session: LoginSession = {
      sessionId,
      platform,
      accountId,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.SESSION_TIMEOUT),
    };

    loginSessions.set(sessionId, session);

    logger.info('Login session started', {
      sessionId,
      platform,
      accountId,
    });

    // Clean up old sessions
    this.cleanupExpiredSessions();

    return {
      sessionId,
      status: 'pending',
    };
  }

  async getLoginStatus(sessionId: string): Promise<LoginStatusResponse> {
    const session = loginSessions.get(sessionId);

    if (!session) {
      return {
        status: 'expired',
        reason: 'Session not found or expired',
      };
    }

    if (new Date() > session.expiresAt) {
      loginSessions.delete(sessionId);
      return {
        status: 'expired',
        reason: 'Session timeout',
      };
    }

    return {
      status: session.status,
    };
  }

  async updateSessionStatus(
    sessionId: string,
    status: 'success' | 'failed',
    reason?: string
  ): Promise<void> {
    const session = loginSessions.get(sessionId);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    session.status = status;

    logger.info('Login session status updated', {
      sessionId,
      status,
      reason,
    });
  }

  async saveSession(
    sessionId: string,
    storageState: string
  ): Promise<void> {
    const session = loginSessions.get(sessionId);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (session.status !== 'success') {
      throw new AppError('Session not in success state', 400);
    }

    // Update account with storage state
    const account = await accountsService.getAccountByPlatformAndId(
      session.platform,
      session.accountId
    );

    await accountsService.updateLoginStatus(account.id, true, storageState);

    // Clean up session
    loginSessions.delete(sessionId);

    logger.info('Session saved to database', {
      sessionId,
      platform: session.platform,
      accountId: session.accountId,
    });
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of loginSessions.entries()) {
      if (now > session.expiresAt) {
        loginSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired login sessions`);
    }
  }

  getActiveSessionCount(): number {
    return loginSessions.size;
  }
}

export const authService = new AuthService();
