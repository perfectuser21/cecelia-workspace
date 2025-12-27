# Docker 部署配置

本目录包含社交媒体指标收集平台的 Docker 部署配置。

## 快速开始

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 编辑配置
nano .env

# 3. 一键部署
cd ../..
./scripts/deploy.sh
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | 主部署配置文件 |
| `.env.example` | 环境变量模板 |
| `.env` | 实际环境变量（需创建） |

## 部署场景

### 最小部署（默认）
```bash
docker-compose up -d
```
**服务**: PostgreSQL + Core API + Frontend

### 包含 n8n
```bash
docker-compose --profile n8n up -d
```
**服务**: 最小部署 + n8n 自动化

### 生产环境
```bash
docker-compose --profile production up -d
```
**服务**: 完整服务 + Nginx 网关

### 所有服务
```bash
docker-compose --profile all up -d
```
**服务**: 所有服务（包括预留功能）

## 环境变量配置

必须配置的变量：

```bash
# 数据库
POSTGRES_PASSWORD=your_secure_password

# 会话密钥（64 字符随机字符串）
SESSION_SECRET=your_random_64_char_string

# 飞书 OAuth
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_REDIRECT_URI=http://localhost:3000/auth/callback
```

生成密钥：
```bash
# 生成 SESSION_SECRET
openssl rand -hex 32

# 生成数据库密码
openssl rand -base64 24
```

## 常用命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f

# 查看状态
docker-compose ps

# 重启服务
docker-compose restart

# 重新构建
docker-compose up -d --build
```

## 服务访问

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| API | http://localhost:3002 |
| n8n | http://localhost:5678 |
| 数据库 | localhost:5432 |

## 完整文档

- [完整部署指南](../../DOCKER_DEPLOYMENT.md)
- [快速开始](../../DOCKER_QUICKSTART.md)
- [配置总结](../../DOCKER_SETUP_SUMMARY.md)

## 故障排查

### 端口冲突
```bash
# 检查端口占用
netstat -tlnp | grep :3002

# 修改端口（编辑 .env）
API_PORT=3003
```

### 容器无法启动
```bash
# 查看日志
docker-compose logs <service-name>

# 重新构建
docker-compose up -d --build --force-recreate
```

### 数据库连接失败
```bash
# 检查数据库状态
docker-compose exec postgres pg_isready -U postgres

# 重启数据库
docker-compose restart postgres
```

## 备份与恢复

```bash
# 备份
../../scripts/backup.sh

# 恢复
../../scripts/restore.sh
```

## 健康检查

```bash
../../scripts/healthcheck.sh
```

## 网络架构

服务通过 `social-metrics-network` (172.28.0.0/16) 通信。

固定 IP 分配：
- PostgreSQL: 172.28.0.10
- Core API: 172.28.0.20
- Frontend: 172.28.0.30
- n8n: 172.28.0.40
- Nginx: 172.28.0.100

## 数据持久化

| 卷名 | 用途 |
|------|------|
| postgres_data | 数据库数据 |
| n8n_data | n8n 工作流 |
| sessions_data | 用户会话 |
| logs_data | 应用日志 |

查看卷：
```bash
docker volume ls | grep social-metrics
```

备份卷：
```bash
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```

## 资源管理

查看资源使用：
```bash
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

清理未使用资源：
```bash
docker system prune -a
```

## 安全建议

- ✓ 修改所有默认密码
- ✓ 使用强随机 SESSION_SECRET
- ✓ 限制数据库外部访问
- ✓ 生产环境启用 HTTPS
- ✓ 定期更新镜像
- ✓ 设置定时备份

## 联系支持

遇到问题请：
1. 查看 [完整文档](../../DOCKER_DEPLOYMENT.md)
2. 运行健康检查
3. 收集日志信息
