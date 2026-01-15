import { WorkerInterface, StorageState, CollectedMetrics } from './worker.interface';
export declare class XWorker implements WorkerInterface {
    readonly platform = "x";
    private readonly loginUrl;
    private readonly analyticsUrl;
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
export declare const xWorker: XWorker;
export default xWorker;
//# sourceMappingURL=x.worker.d.ts.map