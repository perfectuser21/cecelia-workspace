# Metrics Feature

社媒指标数据采集和报表功能模块。

## 文件结构

```
metrics/
├── index.ts               # 模块入口
├── metrics.route.ts       # 路由定义
├── metrics.service.ts     # 业务逻辑
├── metric.repository.ts   # 指标数据库操作
├── report.repository.ts   # 报表数据库操作
├── config.yaml            # 功能配置
└── CLAUDE.md              # 本文档
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /v1/metrics/dashboard | 获取仪表板指标 |
| GET | /v1/metrics/latest/:accountId | 获取账号最新指标 |
| GET | /v1/metrics/account/:accountId | 按日期范围获取账号指标 |
| GET | /v1/metrics/date/:date | 获取指定日期所有指标 |
| GET | /v1/metrics/platform/:platform | 按平台和日期范围获取 |
| GET | /v1/metrics/range | 按日期范围获取所有 |
| POST | /v1/metrics/report_daily | 生成每日报表 |
| GET | /v1/metrics/reports/date/:date | 获取指定日期报表 |
| GET | /v1/metrics/reports/recent | 获取最近报表 |

## 依赖

- `../../shared/db/connection` - 数据库连接
- `../../shared/types` - 共享类型（Metric, Platform, DailyReport）
- `../../shared/middleware/error.middleware` - 错误处理
- `../../shared/utils/logger` - 日志工具
- `../accounts` - 账号服务

## 核心功能

### 指标存储
- 按账号+日期存储指标（upsert）
- 计算粉丝增量（delta）
- 聚合平台数据

### 仪表板
- 支持 today / week / month 时间范围
- 计算总览数据（总粉丝、增量、曝光、互动）
- 按日期趋势数据
- 按平台分组数据

### 报表生成
- 每日自动汇总
- 按平台细分
- 生成摘要文本

## 导出

- `metricService` - 指标服务
- `metricRepository` - 指标数据库操作
- `reportRepository` - 报表数据库操作
