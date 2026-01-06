# VPS Monitor Feature

VPS 资源监控模块。

## 功能

- 实时获取 CPU、内存、磁盘使用情况
- 历史数据记录和查询
- Docker 容器状态监控
- 资源告警

## 文件结构

```
vps-monitor/
├── index.ts               # 模块入口
├── vps-monitor.types.ts   # 类型定义
├── vps-monitor.route.ts   # 路由
├── vps-monitor.service.ts # 业务逻辑（系统命令执行）
├── vps-monitor.repository.ts # 数据库操作
├── config.yaml            # 配置
└── CLAUDE.md              # 说明文档
```

## 依赖

- `../../shared/utils/logger` - 日志工具
- `../../shared/db/connection` - 数据库连接
