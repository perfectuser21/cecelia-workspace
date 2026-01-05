# Panorama Feature

VPS 项目结构全景可视化模块。

## 功能

- 扫描 /home/xx/dev 目录下的项目
- 获取 Docker 服务运行状态
- 提供分层可钻取的项目结构视图
- 工作区白板编辑功能

## 三个维度

1. **runtime-root** - 服务状态（Docker 容器分组）
2. **code-root** - 项目列表（按活跃度分组）
3. **dataflow-root** - 任务流转（可钻取的流程图）

## 文件结构

```
panorama/
├── index.ts           # 模块入口
├── panorama.types.ts  # 类型定义
├── panorama.route.ts  # 路由
├── panorama.service.ts # 业务逻辑
├── config.yaml        # 配置
└── CLAUDE.md          # 说明文档
```

## 依赖

- `../../shared/utils/logger` - 日志工具
