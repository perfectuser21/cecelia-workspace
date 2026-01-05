# Contents Feature

Website 内容管理模块，用于 zenithjoyai.com 网站内容的 CRUD 操作。

## 文件结构

```
contents/
  contents.repository.ts  # 数据库操作
  contents.route.ts       # API 路由
  index.ts               # 模块导出
  config.yaml            # 配置文件
```

## API 端点

### 公开端点
- `GET /api/contents` - 获取所有已发布内容
- `GET /api/contents/slug/:slug` - 按 slug 获取内容

### 管理端点 (需认证)
- `GET /api/contents/admin` - 获取所有内容（含草稿）
- `GET /api/contents/admin/:id` - 按 ID 获取内容
- `POST /api/contents/admin` - 创建内容
- `PUT /api/contents/admin/:id` - 更新内容
- `DELETE /api/contents/admin/:id` - 删除内容
- `POST /api/contents/admin/:id/publish` - 发布内容
- `POST /api/contents/admin/:id/unpublish` - 撤回发布

## 依赖

- shared/db/connection - 数据库连接
- shared/middleware/auth.middleware - 认证中间件
- shared/utils/logger - 日志工具

## 环境变量

- `CLOUDFLARE_DEPLOY_HOOK` - Cloudflare 部署 Hook URL
