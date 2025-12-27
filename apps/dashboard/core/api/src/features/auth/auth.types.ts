// Auth feature types
import { Platform } from '../../shared/types';

export interface LoginSession {
  sessionId: string;
  platform: Platform;
  accountId: string;
  status: 'pending' | 'success' | 'failed';
  createdAt: Date;
  expiresAt: Date;
}

export interface StartLoginResponse {
  sessionId: string;
  qrCodeUrl?: string;
  status: 'pending';
}

export interface LoginStatusResponse {
  status: 'pending' | 'success' | 'expired' | 'failed';
  reason?: string;
}
