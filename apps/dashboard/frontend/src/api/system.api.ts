import { apiClient } from './client';

// Types
export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  avgResponseTime: number;
  errorRate: number;
  activeConnections: number;
  uptime: number;
}

export interface MetricHistory {
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
}

export interface SystemMetricsResponse {
  current: SystemMetrics;
  history: MetricHistory[];
}

// API functions
export const systemApi = {
  // Get system metrics (CPU, memory, response time, etc.)
  getMetrics: async (): Promise<SystemMetricsResponse> => {
    const response = await apiClient.get<SystemMetricsResponse>('/v1/system/metrics');
    return response.data;
  },
};
