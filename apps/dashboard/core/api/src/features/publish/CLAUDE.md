# Publish Feature

多平台内容发布模块，支持图片/视频处理、定时发布、多平台分发。

## 文件结构

```
publish/
  index.ts              # 模块导出
  publish.route.ts      # API 路由
  publish.repository.ts # 数据库操作
  publish.service.ts    # 业务逻辑
  media.service.ts      # 媒体处理（Sharp）
  upload.service.ts     # 文件上传
  config.yaml           # 配置文件
```

## API 端点

### 发布任务
- `GET /v1/publish/stats` - 获取统计信息
- `GET /v1/publish/platforms` - 获取平台规格
- `POST /v1/publish/upload` - 上传文件
- `GET /v1/publish/tasks` - 获取任务列表
- `GET /v1/publish/tasks/:id` - 获取任务详情
- `POST /v1/publish/tasks` - 创建任务
- `PATCH /v1/publish/tasks/:id` - 更新任务
- `DELETE /v1/publish/tasks/:id` - 删除任务
- `POST /v1/publish/tasks/:id/submit` - 提交发布
- `POST /v1/publish/tasks/:id/result` - 更新结果（n8n 回调）
- `POST /v1/publish/tasks/:id/retry/:platform` - 重试平台
- `POST /v1/publish/tasks/:id/copy` - 复制任务
- `POST /v1/publish/tasks/batch` - 批量操作

## 工作流程

1. 创建发布任务（draft）
2. 上传媒体文件
3. 提交发布（submit）
4. 图片按平台规格处理
5. website 平台直接写入 contents
6. 其他平台通过 n8n 工作流处理
7. n8n 完成后回调更新结果

## 依赖

- contents feature - 网站内容发布
- shared/config/platforms.config - 平台规格配置
- sharp - 图片处理

## 环境变量

- `UPLOAD_PATH` - 上传目录
- `PUBLIC_MEDIA_URL` - 媒体文件公开 URL
- `N8N_PUBLISH_WEBHOOK_URL` - n8n 发布工作流 Webhook
- `FEISHU_WEBHOOK_URL` - 飞书通知 Webhook
