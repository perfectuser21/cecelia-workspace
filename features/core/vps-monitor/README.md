# VPS Monitor Module

Server monitoring module for the ZenithJoy Dashboard backend.

## Features

- Real-time system statistics (CPU, memory, disk, network)
- Docker container monitoring with resource usage
- Key service status tracking
- No authentication required (public access)

## API Endpoints

### GET /v1/vps-monitor/stats

Get comprehensive system statistics.

**Response:**
```json
{
  "hostname": "server-hostname",
  "platform": "linux 5.15.0-164-generic",
  "uptime": 9881.76,
  "cpu": {
    "model": "Intel(R) Xeon(R) CPU",
    "cores": 8,
    "usage": 34,
    "loadAverage": {
      "1min": 4.07,
      "5min": 5.26,
      "15min": 4.35
    }
  },
  "memory": {
    "total": 16780251136,
    "used": 11583262720,
    "free": 5196988416,
    "usagePercent": 69
  },
  "disk": {
    "total": "160G",
    "used": "89G",
    "available": "64G",
    "usagePercent": "59%"
  },
  "network": [
    {
      "interface": "eth0",
      "bytesReceived": 1234567890,
      "bytesSent": 987654321,
      "packetsReceived": 123456,
      "packetsSent": 98765
    }
  ],
  "timestamp": 1766488999059
}
```

### GET /v1/vps-monitor/containers

Get list of all Docker containers with resource usage.

**Response:**
```json
{
  "containers": [
    {
      "name": "social-metrics-api",
      "status": "Up 23 seconds",
      "ports": "0.0.0.0:3333->3000/tcp",
      "cpu": "1.11%",
      "memory": "136.9MiB / 15.61GiB"
    },
    {
      "name": "nginx-proxy-manager",
      "status": "Up 3 hours",
      "ports": "0.0.0.0:3000->443/tcp",
      "cpu": "0.50%",
      "memory": "250MiB / 15.61GiB"
    }
  ],
  "totalContainers": 25,
  "runningContainers": 24,
  "timestamp": 1766488999059
}
```

### GET /v1/vps-monitor/services

Get status of key services defined in the configuration.

**Response:**
```json
{
  "services": [
    {
      "name": "Nginx Proxy Manager",
      "containerName": "nginx-proxy-manager",
      "port": 3000,
      "status": "running",
      "uptime": "3 hours"
    },
    {
      "name": "Social Metrics API",
      "containerName": "social-metrics-api",
      "port": 3333,
      "status": "running",
      "uptime": "30 seconds"
    },
    {
      "name": "PostgreSQL",
      "containerName": "social-metrics-postgres",
      "port": 5432,
      "status": "running",
      "uptime": "3 hours"
    },
    {
      "name": "n8n",
      "containerName": "social-metrics-n8n",
      "port": 5678,
      "status": "running",
      "uptime": "19 hours"
    },
    {
      "name": "VPN (xray-reality)",
      "containerName": "xray-reality",
      "port": 443,
      "status": "running",
      "uptime": "3 hours"
    },
    {
      "name": "Feishu Auth",
      "containerName": "feishu-auth-backend",
      "port": 3002,
      "status": "running",
      "uptime": "3 hours"
    }
  ],
  "timestamp": 1766488999059
}
```

## Usage Examples

### With API Key (for consistency with other endpoints)
```bash
curl -H "Authorization: Bearer dev-api-key-2025" \
  http://localhost:3333/v1/vps-monitor/stats
```

### Without API Key (also works)
```bash
curl http://localhost:3333/v1/vps-monitor/stats
```

## Configuration

### Key Services
The module monitors these critical services by default:
- Nginx Proxy Manager (port 3000)
- Social Metrics API (port 3333)
- PostgreSQL (port 5432)
- n8n (port 5678)
- VPN xray-reality (port 443)
- Feishu Auth Backend (port 3002)

To modify the monitored services, edit the `KEY_SERVICES` array in `core/api/src/features/vps-monitor/vps-monitor.service.ts`.

## Requirements

1. **Docker CLI**: The container needs docker CLI installed
2. **Docker Socket**: Mount `/var/run/docker.sock` as read-only volume
3. **Network Access**: Container must be on the same network as monitored containers

These are configured in:
- `Dockerfile`: Installs `docker-cli`
- `docker-compose.yml`: Mounts docker socket as volume

## Error Handling

All endpoints use try-catch blocks and return proper error responses:

```json
{
  "error": "Internal server error",
  "message": "Detailed error message"
}
```

## Module Structure

```
vps-monitor/
├── index.ts                    # Module exports
├── vps-monitor.route.ts        # Route definitions
├── vps-monitor.service.ts      # Business logic & system calls
├── vps-monitor.types.ts        # TypeScript interfaces
└── README.md                   # This file
```

## Notes

- The module uses `execSync` to execute system commands
- Docker stats collection has a 5-second timeout
- Network stats are read from `/proc/net/dev`
- All metrics are collected in real-time (no caching)
