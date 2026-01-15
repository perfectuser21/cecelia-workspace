"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vpsMonitorService = void 0;
// VPS Monitor service for system metrics collection
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const logger_1 = __importDefault(require("../../shared/utils/logger"));
const vps_monitor_repository_1 = require("./vps-monitor.repository");
class VPSMonitorService {
    constructor() {
        // Key services to monitor
        this.KEY_SERVICES = [
            { name: 'Nginx Proxy Manager', containerName: 'nginx-proxy-manager', port: 3000 },
            { name: 'Social Metrics API', containerName: 'social-metrics-api', port: 3333 },
            { name: 'PostgreSQL', containerName: 'social-metrics-postgres', port: 5432 },
            { name: 'n8n', containerName: 'social-metrics-n8n', port: 5678 },
            { name: 'VPN (xray-reality)', containerName: 'xray-reality', port: 443 },
            { name: 'Feishu Auth', containerName: 'feishu-auth-backend', port: 3002 },
        ];
        /**
         * Start automatic metrics collection (every minute)
         */
        this.collectionInterval = null;
        this.cleanupInterval = null;
    }
    /**
     * Get system statistics (CPU, Memory, Disk, Network)
     */
    async getSystemStats() {
        try {
            const cpu = this.getCPUStats();
            const memory = this.getMemoryStats();
            const disk = await this.getDiskStats();
            const network = this.getNetworkStats();
            return {
                hostname: os_1.default.hostname(),
                platform: `${os_1.default.platform()} ${os_1.default.release()}`,
                uptime: os_1.default.uptime(),
                cpu,
                memory,
                disk,
                network,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get system stats', { error });
            throw error;
        }
    }
    /**
     * Get CPU statistics
     */
    getCPUStats() {
        const cpus = os_1.default.cpus();
        const loadAvg = os_1.default.loadavg();
        let totalIdle = 0;
        let totalTick = 0;
        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        const usage = 100 - Math.floor((totalIdle / totalTick) * 100);
        return {
            model: cpus[0].model,
            cores: cpus.length,
            usage,
            loadAverage: {
                '1min': Math.round(loadAvg[0] * 100) / 100,
                '5min': Math.round(loadAvg[1] * 100) / 100,
                '15min': Math.round(loadAvg[2] * 100) / 100,
            },
        };
    }
    /**
     * Get memory statistics
     */
    getMemoryStats() {
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
        const usedMem = totalMem - freeMem;
        const usagePercent = Math.round((usedMem / totalMem) * 100);
        return {
            total: totalMem,
            used: usedMem,
            free: freeMem,
            usagePercent,
        };
    }
    /**
     * Get disk statistics
     */
    async getDiskStats() {
        try {
            // Use simple df -h for Alpine/BusyBox compatibility
            const output = (0, child_process_1.execSync)('df -h / | tail -1', {
                encoding: 'utf-8',
            }).trim();
            // Format: Filesystem Size Used Available Use% Mounted
            const parts = output.split(/\s+/);
            return {
                total: parts[1], // Size
                used: parts[2], // Used
                available: parts[3], // Available
                usagePercent: parts[4], // Use% (e.g., "62%")
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get disk stats', { error });
            return {
                total: 'N/A',
                used: 'N/A',
                available: 'N/A',
                usagePercent: 'N/A',
            };
        }
    }
    /**
     * Get network statistics
     */
    getNetworkStats() {
        try {
            const netData = fs_1.default.readFileSync('/proc/net/dev', 'utf-8');
            const lines = netData.split('\n').slice(2); // Skip header lines
            const stats = [];
            for (const line of lines) {
                if (!line.trim())
                    continue;
                const parts = line.trim().split(/\s+/);
                const interfaceName = parts[0].replace(':', '');
                // Skip loopback interface
                if (interfaceName === 'lo')
                    continue;
                stats.push({
                    interface: interfaceName,
                    bytesReceived: parseInt(parts[1]) || 0,
                    bytesSent: parseInt(parts[9]) || 0,
                    packetsReceived: parseInt(parts[2]) || 0,
                    packetsSent: parseInt(parts[10]) || 0,
                });
            }
            return stats;
        }
        catch (error) {
            logger_1.default.error('Failed to get network stats', { error });
            return [];
        }
    }
    /**
     * Get Docker containers list and stats
     */
    async getDockerStats() {
        try {
            // Get basic container info
            const psOutput = (0, child_process_1.execSync)('docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"', {
                encoding: 'utf-8',
            }).trim();
            const containers = [];
            const lines = psOutput.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const [name, status, ports] = line.split('\t');
                containers.push({
                    name,
                    status,
                    ports: ports || '',
                });
            }
            // Try to get resource stats for running containers
            try {
                // 获取 CPU%, 内存%, 内存使用量
                const statsOutput = (0, child_process_1.execSync)('docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemPerc}}\t{{.MemUsage}}"', {
                    encoding: 'utf-8',
                    timeout: 10000,
                }).trim();
                const statsLines = statsOutput.split('\n').filter(line => line.trim());
                const statsMap = new Map();
                for (const line of statsLines) {
                    const [name, cpu, memPercent, memory] = line.split('\t');
                    // 解析百分比字符串为数字 (e.g., "33.12%" -> 33.12)
                    const cpuNum = parseFloat(cpu.replace('%', '')) || 0;
                    const memNum = parseFloat(memPercent.replace('%', '')) || 0;
                    statsMap.set(name, {
                        cpu,
                        cpuPercent: cpuNum,
                        memory,
                        memoryPercent: memNum
                    });
                }
                // Merge stats with container info
                containers.forEach(container => {
                    const stats = statsMap.get(container.name);
                    if (stats) {
                        container.cpu = stats.cpu;
                        container.cpuPercent = stats.cpuPercent;
                        container.memory = stats.memory;
                        container.memoryPercent = stats.memoryPercent;
                    }
                });
            }
            catch (statsError) {
                logger_1.default.warn('Failed to get docker stats (non-critical)', { error: statsError });
            }
            const runningContainers = containers.filter(c => c.status.startsWith('Up')).length;
            return {
                containers,
                totalContainers: containers.length,
                runningContainers,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get docker stats', { error });
            throw error;
        }
    }
    /**
     * Get status of key services
     */
    async getServicesStatus() {
        try {
            const dockerStats = await this.getDockerStats();
            const containerMap = new Map(dockerStats.containers.map(c => [c.name, c]));
            const services = this.KEY_SERVICES.map(service => {
                const container = containerMap.get(service.containerName || '');
                if (!container) {
                    return {
                        name: service.name,
                        containerName: service.containerName,
                        port: service.port,
                        status: 'unknown',
                    };
                }
                const isRunning = container.status.startsWith('Up');
                const uptime = isRunning
                    ? container.status.replace(/^Up\s+/, '').split('\s')[0]
                    : undefined;
                return {
                    name: service.name,
                    containerName: service.containerName,
                    port: service.port,
                    status: isRunning ? 'running' : 'stopped',
                    uptime,
                };
            });
            return {
                services,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get services status', { error });
            throw error;
        }
    }
    /**
     * Save current metrics to database
     */
    async saveMetrics() {
        try {
            const stats = await this.getSystemStats();
            // Calculate total network RX/TX from all interfaces
            const networkRx = stats.network.reduce((sum, net) => sum + net.bytesReceived, 0);
            const networkTx = stats.network.reduce((sum, net) => sum + net.bytesSent, 0);
            // Parse disk usage percent (handle % sign or N/A)
            let diskUsagePercent = 0;
            if (stats.disk.usagePercent && stats.disk.usagePercent !== 'N/A') {
                const parsed = parseFloat(stats.disk.usagePercent.replace('%', ''));
                diskUsagePercent = isNaN(parsed) ? 0 : parsed;
            }
            await vps_monitor_repository_1.vpsMonitorRepository.saveMetric({
                cpuUsage: stats.cpu.usage,
                memoryUsagePercent: stats.memory.usagePercent,
                memoryUsed: stats.memory.used,
                diskUsagePercent,
                load1min: stats.cpu.loadAverage['1min'],
                load5min: stats.cpu.loadAverage['5min'],
                load15min: stats.cpu.loadAverage['15min'],
                networkRx,
                networkTx,
            });
            logger_1.default.debug('VPS metrics saved successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to save VPS metrics', { error });
        }
    }
    /**
     * Get metrics history for the last N hours
     */
    async getMetricsHistory(hours = 24) {
        try {
            const rows = await vps_monitor_repository_1.vpsMonitorRepository.getHistory(hours);
            return rows.map(row => ({
                time: new Date(row.created_at).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                cpu: Number(row.cpu_usage.toFixed(1)),
                memory: Number(row.memory_usage_percent.toFixed(1)),
                load: Number(row.load_1min.toFixed(2)),
                disk: Number(row.disk_usage_percent.toFixed(1)),
            }));
        }
        catch (error) {
            logger_1.default.error('Failed to get metrics history', { error });
            throw error;
        }
    }
    startMetricsCollection() {
        if (this.collectionInterval) {
            logger_1.default.warn('Metrics collection already running');
            return;
        }
        logger_1.default.info('Starting VPS metrics collection (every 1 minute)');
        // Collect immediately
        this.saveMetrics();
        // Then collect every minute
        this.collectionInterval = setInterval(() => {
            this.saveMetrics();
        }, 60 * 1000); // 60 seconds
        // Cleanup old data daily at 3 AM
        const now = new Date();
        const next3AM = new Date(now);
        next3AM.setHours(3, 0, 0, 0);
        if (next3AM <= now) {
            next3AM.setDate(next3AM.getDate() + 1);
        }
        const msUntil3AM = next3AM.getTime() - now.getTime();
        setTimeout(() => {
            vps_monitor_repository_1.vpsMonitorRepository.cleanupOldMetrics();
            // Then run daily
            this.cleanupInterval = setInterval(() => {
                vps_monitor_repository_1.vpsMonitorRepository.cleanupOldMetrics();
            }, 24 * 60 * 60 * 1000); // 24 hours
        }, msUntil3AM);
    }
    stopMetricsCollection() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
            logger_1.default.info('VPS metrics collection stopped');
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}
exports.vpsMonitorService = new VPSMonitorService();
//# sourceMappingURL=vps-monitor.service.js.map