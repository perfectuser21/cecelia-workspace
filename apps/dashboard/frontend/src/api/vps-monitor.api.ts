import { apiClient } from './client';

// Types matching backend response
export interface SystemStats {
  hostname: string;
  platform: string;
  uptime: number;
  cpu: {
    model: string;
    cores: number;
    usage: number;
    loadAverage: {
      '1min': number;
      '5min': number;
      '15min': number;
    };
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: string;
    used?: string;
    available?: string;
    usagePercent?: number;
  };
  network: Array<{
    interface: string;
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
  }>;
  timestamp: number;
}

export interface ContainerInfo {
  name: string;
  status: string;
  ports: string;
  cpu: string;           // CPU 使用率字符串，如 "33.12%"
  cpuPercent: number;    // CPU 使用率数值，如 33.12
  memory: string;        // 内存使用量，如 "789.2MiB / 15.61GiB"
  memoryPercent: number; // 内存使用率数值，如 4.94
}

export interface ContainersResponse {
  containers: ContainerInfo[];
  running: number;
  total: number;
  timestamp: number;
}

export interface ServiceInfo {
  name: string;
  containerName: string;
  port: number;
  status: 'running' | 'stopped' | 'unknown';
  uptime: string;
}

export interface ServicesResponse {
  services: ServiceInfo[];
  timestamp: number;
}

export interface MetricPoint {
  time: string;
  cpu: number;
  memory: number;
  load: number;
  disk: number;
}

export interface MetricsHistoryResponse {
  metrics: MetricPoint[];
}

// API functions
export const vpsMonitorApi = {
  getStats: async (): Promise<SystemStats> => {
    const response = await apiClient.get<SystemStats>('/v1/vps-monitor/stats');
    return response.data;
  },

  getContainers: async (): Promise<ContainersResponse> => {
    const response = await apiClient.get<ContainersResponse>('/v1/vps-monitor/containers');
    return response.data;
  },

  getServices: async (): Promise<ServicesResponse> => {
    const response = await apiClient.get<ServicesResponse>('/v1/vps-monitor/services');
    return response.data;
  },

  getHistory: async (hours: number = 24): Promise<MetricPoint[]> => {
    const response = await apiClient.get<MetricsHistoryResponse>(
      `/v1/vps-monitor/history?hours=${hours}`
    );
    return response.data.metrics;
  },
};
