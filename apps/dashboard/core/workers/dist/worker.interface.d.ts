export interface StorageState {
    cookies: Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
        expires?: number;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: 'Strict' | 'Lax' | 'None';
    }>;
    origins?: Array<{
        origin: string;
        localStorage: Array<{
            name: string;
            value: string;
        }>;
    }>;
}
export interface CollectedMetrics {
    followers_total: number;
    impressions: number;
    engagements: number;
    posts_published: number;
    top_post_url?: string;
    top_post_engagement?: number;
}
export interface WorkerInterface {
    /**
     * Platform identifier
     */
    readonly platform: string;
    /**
     * Check if the account is still logged in
     * @param accountId Platform account ID
     * @param storageState Saved browser state
     * @returns true if logged in, false otherwise
     */
    healthCheck(accountId: string, storageState: StorageState): Promise<boolean>;
    /**
     * Collect daily metrics for an account
     * @param accountId Platform account ID
     * @param date Collection date (YYYY-MM-DD)
     * @param storageState Saved browser state
     * @returns Collected metrics
     */
    collectDaily(accountId: string, date: string, storageState: StorageState): Promise<CollectedMetrics>;
    /**
     * Start interactive login process
     * @param accountId Platform account ID
     * @returns Session information including QR code or login URL
     */
    startLogin(accountId: string): Promise<{
        sessionId: string;
        qrCodeUrl?: string;
        loginPageUrl?: string;
    }>;
    /**
     * Check login session status
     * @param sessionId Session identifier
     * @returns Login status and storage state if successful
     */
    checkLoginStatus(sessionId: string): Promise<{
        status: 'pending' | 'success' | 'expired' | 'failed';
        storageState?: StorageState;
    }>;
}
export default WorkerInterface;
//# sourceMappingURL=worker.interface.d.ts.map