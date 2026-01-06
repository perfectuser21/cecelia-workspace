# N8n Workflows Feature

n8n 工作流管理模块。

## 功能

- 获取工作流列表和详情
- 查询执行记录
- 支持多实例（local/cloud）
- 工作流运行统计

## 多实例支持

- **local**: 本地部署的 n8n
- **cloud**: n8n Cloud 实例

## 文件结构

```
n8n-workflows/
├── index.ts                   # 模块入口
├── n8n-workflows.types.ts     # 类型定义
├── n8n-workflows.route.ts     # 路由
├── n8n-workflows.service.ts   # 业务逻辑（API 代理）
├── config.yaml                # 配置
└── CLAUDE.md                  # 说明文档
```

## 依赖

- `../../shared/utils/logger` - 日志工具
