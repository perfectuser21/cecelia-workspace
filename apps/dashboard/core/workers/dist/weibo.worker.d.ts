import { WorkerInterface, StorageState, CollectedMetrics } from './worker.interface';
export declare class WeiboWorker implements WorkerInterface {
    readonly platform = "weibo";
    private readonly loginUrl;
    private readonly creatorUrl;
    private readonly timeout;
    healthCheck(accountId: string, storageState: StorageState): Promise<boolean>;
    collectDaily(accountId: string, date: string, storageState: StorageState): Promise<CollectedMetrics>;
    startLogin(accountId: string): Promise<{
        sessionId: string;
        qrCodeUrl?: string;
        loginPageUrl?: string;
    }>;
    checkLoginStatus(sessionId: string): Promise<{
        status: 'pending' | 'success' | 'expired' | 'failed';
        storageState?: StorageState;
    }>;
    cleanupSessions(): Promise<void>;
}
export declare const weiboWorker: WeiboWorker;
export default weiboWorker;
//# sourceMappingURL=weibo.worker.d.ts.map