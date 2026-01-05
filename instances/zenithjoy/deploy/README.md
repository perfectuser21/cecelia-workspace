# ZenithJoy Autopilot - 部署指南

## 快速部署

```bash
# 1. 复制环境变量
cp deploy/.env.example deploy/.env
# 编辑 .env 填写实际配置

# 2. 启动服务
docker compose -f deploy/docker-compose.yml up -d

# 3. 检查状态
docker compose -f deploy/docker-compose.yml ps
```

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| postgres | 5432 | PostgreSQL 数据库 |
| api | 3333 | Dashboard API |
| n8n | 5678/5679 | 工作流引擎 |

## 更新部署

```bash
# 更新 API
docker compose -f deploy/docker-compose.yml build api
docker compose -f deploy/docker-compose.yml up -d api

# 更新所有服务
docker compose -f deploy/docker-compose.yml pull
docker compose -f deploy/docker-compose.yml up -d
```

## 日志查看

```bash
# 查看所有日志
docker compose -f deploy/docker-compose.yml logs -f

# 查看特定服务
docker compose -f deploy/docker-compose.yml logs -f api
```
