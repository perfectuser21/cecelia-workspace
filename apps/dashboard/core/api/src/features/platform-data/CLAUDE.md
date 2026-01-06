# Platform Data Feature

多平台内容数据聚合模块，用于存储和查询来自各平台的内容指标数据。

## 文件结构

```
platform-data/
  index.ts              # 模块导出
  platform-data.route.ts # API 路由
  config.yaml           # 配置文件
```

## API 端点

- `GET /api/platform-data` - 获取内容列表（支持过滤）
- `GET /api/platform-data/stats` - 获取聚合统计
- `GET /api/platform-data/grouped` - 按内容形式分组查询
- `GET /api/platform-data/:contentId/metrics` - 获取内容指标历史
- `POST /api/platform-data/batch` - 批量插入/更新数据（爬虫用）

## 数据模型

### content_items
- 基础内容信息
- 最新指标数据
- 跨平台聚合

### content_metrics
- 历史指标快照
- 按天数记录（1, 2, 3, 5, 7, 15, 30）

## 查询功能

### 分组查询 (grouped)
- 按内容形式分组：视频、图文、长文
- 以抖音 content_type 为准判断形式
- 跨平台聚合统计
- 标记高表现内容（>1.5x 平均值）

## 依赖

- shared/db/connection - 数据库连接
- shared/utils/logger - 日志工具
