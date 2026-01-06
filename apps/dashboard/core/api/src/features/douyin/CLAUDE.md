# Douyin Feature

抖音登录和 Cookie 管理模块，通过 VPS API 代理实现。

## 文件结构

```
douyin/
  index.ts        # 模块导出
  douyin.route.ts # API 路由
  config.yaml     # 配置文件
```

## API 端点

### 登录流程
- `GET/POST /douyin/get-qrcode` - 获取登录二维码
- `GET /douyin/check-status` - 检查登录状态
- `GET /douyin/validate` - 验证 Cookie 有效性
- `POST /douyin/upload-cookies` - 手动上传 Cookie

### 状态查询
- `GET /douyin/platforms-status` - 获取所有平台状态

## VPS API

通过 `host.docker.internal:9876` 访问主机上的 VPS API 服务：

- `POST /douyin/qrcode` - 获取二维码
- `GET /douyin/status` - 检查状态
- `GET /douyin/validate` - 在线验证
- `POST /douyin/upload-cookies` - 上传 Cookie

## 环境变量

- `VPS_API_HOST` - VPS API 主机地址（默认 host.docker.internal）

## 支持平台

- 抖音 (douyin)
- 小红书 (xiaohongshu) - 待实现
- 快手 (kuaishou) - 待实现
- B站 (bilibili) - 待实现
