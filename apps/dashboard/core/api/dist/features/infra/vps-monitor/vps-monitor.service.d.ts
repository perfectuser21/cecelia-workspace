import { SystemStats, DockerStats, ServicesResponse } from './vps-monitor.types';
declare class VPSMonitorService {
    private readonly KEY_SERVICES;
    /**
     * Get system statistics (CPU, Memory, Disk, Network)
     */
    getSystemStats(): Promise<SystemStats>;
    /**
     * Get CPU statistics
     */
    private getCPUStats;
    /**
     * Get memory statistics
     */
    private getMemoryStats;
    /**
     * Get disk statistics
     */
    private getDiskStats;
    /**
     * Get network statistics
     */
    private getNetworkStats;
    /**
     * Get Docker containers list and stats
     */
    getDockerStats(): Promise<DockerStats>;
    /**
     * Get status of key services
     */
    getServicesStatus(): Promise<ServicesResponse>;
    /**
     * Save current metrics to database
     */
    saveMetrics(): Promise<void>;
    /**
     * Get metrics history for the last N hours
     */
    getMetricsHistory(hours?: number): Promise<any[]>;
    /**
     * Start automatic metrics collection (every minute)
     */
    private collectionInterval;
    private cleanupInterval;
    startMetricsCollection(): void;
    stopMetricsCollection(): void;
}
export declare const vpsMonitorService: VPSMonitorService;
export {};
//# sourceMappingURL=vps-monitor.service.d.ts.map