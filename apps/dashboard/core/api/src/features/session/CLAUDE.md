# Session Feature

Session 监控功能模块，通过 CDP 协议监控 Windows Chrome 浏览器的登录状态。

## 文件结构

```
session/
├── index.ts           # 模块入口
├── session.route.ts   # 路由定义（含全部逻辑）
├── config.yaml        # 功能配置
└── CLAUDE.md          # 本文档
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/session/status | 获取所有平台状态 |
| POST | /api/session/check | 触发检查所有平台 |
| GET | /api/session/check/:platform | 检查单个平台 |
| GET | /api/session/runner | 获取 Windows Runner 状态 |

## 架构

```
Dashboard API  ──CDP──> Windows Runner (Tailscale)
                        └── Chrome 实例 (9个平台)
                            ├── 抖音 :19222
                            ├── 快手 :19223
                            └── ...
```

## 平台配置

| 平台 | CDP 端口 | 登录 URL 关键词 |
|------|----------|-----------------|
| 抖音 | 19222 | creator.douyin.com |
| 快手 | 19223 | cp.kuaishou.com |
| 小红书 | 19224 | creator.xiaohongshu.com |
| 头条主号 | 19225 | mp.toutiao.com |
| 头条副号 | 19226 | mp.toutiao.com |
| 微博 | 19227 | weibo.com |
| 视频号 | 19228 | channels.weixin.qq.com |
| 公众号 | 19229 | mp.weixin.qq.com |
| 知乎 | 19230 | zhihu.com/creator |

## 状态判断

- **online**: 当前 URL 包含平台创作者中心 URL
- **offline**: 当前 URL 包含登录关键词（login, passport, sso 等）
- **unknown**: 无法确定状态

## Windows Runner

- IP: 100.98.253.95 (Tailscale)
- Port: 3000
- API Key: runner-secure-key-ax2024-9f8e7d6c5b4a

## 注意事项

- 无需认证（requiresAuth: false）
- 使用内存缓存状态
- CDP 请求超时：5 秒
