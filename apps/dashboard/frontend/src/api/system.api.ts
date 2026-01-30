import { apiClient } from './client';

// Types
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  latency_ms: number | null;
  last_check: string | null;
  error: string | null;
}

export interface SystemHealthResponse {
  success: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  services: Record<string, ServiceHealth>;
  degraded: boolean;
  degraded_reason: string | null;
  timestamp: string;
}

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

  // Get system health (multi-service aggregated)
  getHealth: async (): Promise<SystemHealthResponse> => {
    const response = await apiClient.get<SystemHealthResponse>('/system/health');
    return response.data;
  },
};
