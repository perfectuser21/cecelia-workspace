import { Platform, CollectDailyRequest, CollectDailyResponse, HealthCheckRequest, HealthCheckResponse } from '../../../shared/types';
interface WorkerInterface {
    healthCheck(accountId: string, storageState?: string): Promise<boolean>;
    collectDaily(accountId: string, date: string, storageState?: string): Promise<any>;
}
export declare class CollectService {
    private workers;
    registerWorker(platform: Platform, worker: WorkerInterface): void;
    getWorker(platform: Platform): WorkerInterface;
    healthCheck(request: HealthCheckRequest): Promise<HealthCheckResponse>;
    collectDaily(request: CollectDailyRequest): Promise<CollectDailyResponse>;
    collectAllAccounts(date: string): Promise<CollectDailyResponse[]>;
}
export declare const collectService: CollectService;
export default collectService;
//# sourceMappingURL=collect.service.d.ts.map