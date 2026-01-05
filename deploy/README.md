# 部署配置

每个 instance 有自己的部署配置：

```
instances/
├── zenithjoy/deploy/    # 生产环境
├── develop/deploy/      # 开发环境
└── dad/deploy/          # (待配置)
```

## 快速启动

```bash
# 生产环境
docker compose -f instances/zenithjoy/deploy/docker-compose.yml up -d

# 开发环境
docker compose -f instances/develop/deploy/docker-compose.yml up -d
```
