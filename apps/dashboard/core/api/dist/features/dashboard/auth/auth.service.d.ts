import { Platform } from '../../../shared/types';
import { StartLoginResponse, LoginStatusResponse } from './auth.types';
declare class AuthService {
    private readonly SESSION_TIMEOUT;
    startLogin(platform: Platform, accountId: string): Promise<StartLoginResponse>;
    getLoginStatus(sessionId: string): Promise<LoginStatusResponse>;
    updateSessionStatus(sessionId: string, status: 'success' | 'failed', reason?: string): Promise<void>;
    saveSession(sessionId: string, storageState: string): Promise<void>;
    private cleanupExpiredSessions;
    getActiveSessionCount(): number;
}
export declare const authService: AuthService;
export {};
//# sourceMappingURL=auth.service.d.ts.map