import { N8nInstance, N8nExecutionDetail, LiveStatusOverview } from './n8n-live-status.types';
declare class N8nLiveStatusService {
    /**
     * Check if instance is available
     */
    isInstanceAvailable(instance: N8nInstance): boolean;
    /**
     * Get instance config
     */
    private getInstanceConfig;
    /**
     * Generic fetch method for n8n API
     */
    private fetchN8n;
    /**
     * Calculate duration in seconds
     */
    private calculateDuration;
    /**
     * Get today's start timestamp
     */
    private getTodayStart;
    /**
     * Parse execution nodes from execution data
     */
    private parseExecutionNodes;
    /**
     * Get live status overview
     */
    getLiveStatusOverview(instance: N8nInstance): Promise<LiveStatusOverview>;
    /**
     * Get execution detail by ID
     */
    getExecutionDetail(instance: N8nInstance, executionId: string): Promise<N8nExecutionDetail>;
}
export declare const n8nLiveStatusService: N8nLiveStatusService;
export {};
//# sourceMappingURL=n8n-live-status.service.d.ts.map