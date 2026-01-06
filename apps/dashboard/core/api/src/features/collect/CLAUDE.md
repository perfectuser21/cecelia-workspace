# Collect Feature

数据采集编排模块，协调各平台 Worker 进行数据采集。

## 文件结构

```
collect/
  index.ts           # 模块导出
  collect.route.ts   # API 路由
  collect.service.ts # 采集服务
  config.yaml        # 配置文件
```

## API 端点

- `POST /v1/collect/healthcheck` - 账号登录状态检查
- `POST /v1/collect/collect_daily` - 单账号日常数据采集
- `POST /v1/collect/store_metrics` - 存储采集数据
- `POST /v1/collect/collect_all` - 批量采集所有账号

## 工作流程

1. 注册平台 Worker
2. 健康检查验证登录状态
3. 使用 storage_state 访问平台
4. 采集日常指标数据
5. 计算增量（delta）
6. 存储到 metrics 表

## Worker 接口

```typescript
interface WorkerInterface {
  healthCheck(accountId: string, storageState?: string): Promise<boolean>;
  collectDaily(accountId: string, date: string, storageState?: string): Promise<any>;
}
```

## 依赖

- accounts feature - 账号管理
- metrics feature - 指标存储
- shared/types - 类型定义
