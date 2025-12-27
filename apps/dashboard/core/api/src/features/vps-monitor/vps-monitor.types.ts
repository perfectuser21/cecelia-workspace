// VPS Monitor types

export interface CPUStats {
  model: string;
  cores: number;
  usage: number;
  loadAverage: {
    '1min': number;
    '5min': number;
    '15min': number;
  };
}

export interface MemoryStats {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

export interface DiskStats {
  total: string;
  used: string;
  available: string;
  usagePercent: string;
}

export interface NetworkStats {
  interface: string;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
}

export interface SystemStats {
  hostname: string;
  platform: string;
  uptime: number;
  cpu: CPUStats;
  memory: MemoryStats;
  disk: DiskStats;
  network: NetworkStats[];
  timestamp: number;
}

export interface DockerContainer {
  name: string;
  status: string;
  ports: string;
  cpu?: string;           // CPU 使用率，如 "33.12%"
  cpuPercent?: number;    // CPU 使用率数值，如 33.12
  memory?: string;        // 内存使用量，如 "789.2MiB / 15.61GiB"
  memoryPercent?: number; // 内存使用率数值，如 4.94
}

export interface DockerStats {
  containers: DockerContainer[];
  totalContainers: number;
  runningContainers: number;
  timestamp: number;
}

export interface ServiceStatus {
  name: string;
  containerName?: string;
  port?: number;
  status: 'running' | 'stopped' | 'unknown';
  uptime?: string;
}

export interface ServicesResponse {
  services: ServiceStatus[];
  timestamp: number;
}
