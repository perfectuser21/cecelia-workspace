export interface VPSMetricRow {
    id: number;
    cpu_usage: number;
    memory_usage_percent: number;
    memory_used: number;
    disk_usage_percent: number;
    load_1min: number;
    load_5min: number;
    load_15min: number;
    network_rx: number;
    network_tx: number;
    created_at: Date;
}
export interface MetricData {
    cpuUsage: number;
    memoryUsagePercent: number;
    memoryUsed: number;
    diskUsagePercent: number;
    load1min: number;
    load5min: number;
    load15min: number;
    networkRx: number;
    networkTx: number;
}
declare class VPSMonitorRepository {
    /**
     * Save metrics to database
     */
    saveMetric(data: MetricData): Promise<void>;
    /**
     * Get metrics history for the last N hours
     */
    getHistory(hours: number): Promise<VPSMetricRow[]>;
    /**
     * Delete old metrics (keep only last 7 days)
     */
    cleanupOldMetrics(): Promise<number>;
}
export declare const vpsMonitorRepository: VPSMonitorRepository;
export {};
//# sourceMappingURL=vps-monitor.repository.d.ts.map