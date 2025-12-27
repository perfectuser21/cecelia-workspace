## [test-fix-1735224400] - 2025-12-26

### Added
- PRD: 创建一个 n8n workflow 接收 GitHub webhook：1. 使用 Webhook 节点接收 POST 请求 2. 使用 Code 节点解析 commit message 3. 使用 IF 节点判断 message 是否包含 deploy 4. 如果包含就用 HTTP 节点触发部署
- Tasks: 1

## [release-test-2-1735222000] - 2025-12-26

### Added
- PRD: 创建一个每天早上9点执行的定时任务：1. 检查服务器磁盘使用率 2. 如果超过80%就发飞书告警
- Tasks: 1

## [verify-final-1735221000] - 2025-12-26

### Added
- PRD: 创建一个 Ping webhook 返回 pong
- Tasks: 1

## [verify-mech-v2-1735220600] - 2025-12-26

### Added
- PRD: 创建一个 Ping webhook 返回 pong
- Tasks: 1

## [no-haiku-1766756500] - 2025-12-26

### Added
- PRD: 创建一个 Ping webhook，返回 pong
- Tasks: 1

## [verify-complete-1766756100] - 2025-12-26

### Added
- PRD: 创建一个每小时检查 GitHub 仓库 star 数量的 workflow，如果有新增 star 就发飞书通知
- Tasks: 1

## [verify-fix-1766752200] - 2025-12-26

### Added
- PRD: 创建一个 Webhook 测试 workflow：收到 POST 请求后返回 pong
- Tasks: 1

## [time-test-1766748799] - 2025-12-26

### Added
- PRD: 创建定时任务 workflow：每天凌晨 3 点清理临时文件，完成后发飞书通知
- Tasks: 1

## [github-star-1766747508] - 2025-12-26

### Added
- PRD: 创建 GitHub Star 通知 workflow：1. 每小时检查指定仓库的 star 数量 2. 与上次记录对比 3. 如果有新增 star 发送飞书通知 4. Error Trigger 处理异常
- Tasks: 1

## [final-v1-1766747057] - 2025-12-26

### Added
- PRD: 创建 VPS 健康检查 workflow：1. Schedule Trigger 每小时触发 2. SSH 检查磁盘空间 3. 超过80%时发飞书告警 4. Error Trigger 处理异常
- Tasks: 1

## 2025-12-26 (Auto-sync)

### 删除 Workflows (6)

以下 VNC 登录相关的 workflows 已被删除（已迁移到 Windows ROG 架构）:

- **抖音登录 (VNC)** (ID: `ktHwzUEyhzSQRcO4`)
  - 删除前节点: 8 个

- **快手登录 (VNC)** (ID: `3ulpraIMG7D4o5zk`)
  - 删除前节点: 7 个

- **小红书登录 (VNC)** (ID: `8ChgYWJK2hZHOfAS`)
  - 删除前节点: 7 个

- **今日头条登录 (VNC)** (ID: `yRJbCbCvMxGSRrXO`)
  - 删除前节点: 7 个

- **微博登录 (VNC)** (ID: `CGNLCeg6wSima2hF`)
  - 删除前节点: 7 个

- **视频号登录 (VNC)** (ID: `UBRn8HMmbYpBOqAF`)
  - 删除前节点: 7 个

### 更新 Workflows (1)

- **nightly-scheduler** (ID: `YFqEplFiSl5Qd3x9`)
  - 更新时间: 2025-12-26T03:21:53.028Z (之前: 2025-12-24T02:25:33.098Z)
  - 节点数: 18 个 (之前: 20 个)
  - 变更说明: 移除了 log-triage 相关的 2 个节点

### 总结

- 当前 workflows 总数: 16 个 (全部已激活)
- 删除 6 个 VNC 登录 workflows (迁移到 Windows ROG)
- 更新 1 个调度器 workflow (简化流程)

---

## [final-test-001] - 2025-12-26

### Added
- PRD: 创建 ping webhook 返回 pong
- Tasks: 1

## [stress-v2-1] - 2025-12-26

### Added
- PRD: 创建 health check webhook
- Tasks: 1

## [stress-v2-2] - 2025-12-26

### Added
- PRD: 创建 status webhook
- Tasks: 1

## [stress-v2-3] - 2025-12-26

### Added
- PRD: 创建 echo webhook
- Tasks: 1

## [debug-test-2] - 2025-12-26

### Added
- PRD: ping
- Tasks: 1

## [concurrent-3] - 2025-12-26

### Added
- PRD: 创建 ping-3 webhook
- Tasks: 1

## [concurrent-2] - 2025-12-26

### Added
- PRD: 创建 ping-2 webhook
- Tasks: 1

## [test-after-fix-001] - 2025-12-26

### Added
- PRD: 创建一个简单的 Ping webhook，返回 pong
- Tasks: 1

## [complex-test-003] - 2025-12-25

### Added
- PRD: 创建一个 GitHub Star 通知系统：
1. 每小时检查指定仓库的 star 数量
2. 如果 star 数增加，发送飞书通知
3. 记录历史数据到 n8n 内置存储
4. 通知内容包含：仓库名、当前 star 数、增加数量、时间戳
- Tasks: 5

## [test-fix-001] - 2025-12-25

### Added
- PRD: 创建一个 Ping webhook，收到请求返回 pong
- Tasks: 1

## [snapshot-init] - 2025-12-25

### System
- 创建 workflows-snapshot.json 初始快照
- 当前 n8n 共有 22 个 workflows (全部已激活)
- 建立自动同步基线

## [fix-test-002] - 2025-12-25

### Added
- PRD: 创建 Ping webhook
- Tasks: 1

## [20251225-full-test2] - 2025-12-25

### Added
- PRD: 创建一个 Ping webhook，收到请求返回 pong 和时间戳
- Tasks: 1

## [20251225-simple-test] - 2025-12-25

### Added
- PRD: 创建一个简单的 Ping webhook 返回 pong
- Tasks: 1

## [] - 2025-12-25

### Added
- PRD: 
- Tasks: 0

## [20251224234639-5ciy6h] - 2025-12-25

### Added
- PRD: 创建一个 Ping Webhook，收到请求后返回 pong
- Tasks: 1

## [20251224233345-4kh7g9] - 2025-12-25

### Added
- PRD: 创建一个 Health Check Workflow，返回服务状态 JSON
- Tasks: 2

## [20251224232821-6epl75] - 2025-12-25

### Added
- PRD: 创建一个 Test Workflow，接收 webhook POST 请求后返回 {"status": "ok"} 响应
- Tasks: 1

## [20251224230702-h4o81j] - 2025-12-25

### Added
- PRD: 测试：创建一个返回 hello world 的简单 workflow
- Tasks: 0

## [20251224143436-g0m0af] - 2025-12-24

### Added
- PRD: 创建一个手动触发后返回 hello world 的简单 workflow
- Tasks: 0

# Workflow Changelog

自动记录 n8n workflow 的变更历史。

---

## 2025-12-24 (Auto-sync)

### 新增 Workflows (8)

- **nightly-scheduler** (ID: `YFqEplFiSl5Qd3x9`)
  - 创建时间: 2025-12-23T14:02:27.424Z
  - 最后更新: 2025-12-24T02:25:33.098Z
  - 状态: 已激活
  - 节点: Schedule Trigger → Initialize State → Execute: health-check → Record: health-check → Execute: backup → Record: backup → Execute: cleanup → Record: cleanup → Execute: log-triage → Record: log-triage → Check Failures → Has Failures? → Write to Notion / Check Beijing Time → Is Working Hours? → Wait Until Morning / Prepare Retries → Format Notification → Send Feishu Notification / Success Summary
  - 用途: 夜间任务调度主控（健康检查/备份/清理/日志分类）

- **夜间健康检查** (ID: `wqeeHpnTcJolnse4`)
  - 创建时间: 2025-12-24T01:27:37.017Z
  - 最后更新: 2025-12-24T01:56:52.727Z
  - 状态: 已激活
  - 节点: 手动触发 / 占位触发器 → 执行健康检查 (SSH) → 解析结果 (Code)
  - 用途: 子 workflow - 检查磁盘/容器/内存状态

- **夜间备份** (ID: `70DVZ55roILCGAMM`)
  - 创建时间: 2025-12-24T01:29:13.304Z
  - 最后更新: 2025-12-24T01:57:37.646Z
  - 状态: 已激活
  - 节点: 手动触发 / 占位触发器 → 执行备份 (SSH) → 解析结果 (Code)
  - 用途: 子 workflow - 备份 session/脚本/报告，保留 7 天

- **夜间清理** (ID: `wOg5NRZ2yx0D18nY`)
  - 创建时间: 2025-12-24T01:29:47.490Z
  - 最后更新: 2025-12-24T01:58:27.981Z
  - 状态: 已激活
  - 节点: 手动触发 / 占位触发器 → 执行清理 (SSH) → 解析结果 (Code)
  - 用途: 子 workflow - 清理 /tmp/docker/Chrome 缓存

- **数据采集调度器** (ID: `4zvOIMtubKNF7QC6`)
  - 创建时间: 2025-12-24T04:32:52.136Z
  - 最后更新: 2025-12-24T05:08:58.655Z
  - 状态: 已激活
  - 节点: 定时触发 / 手动触发 → 初始化 → 1-抖音 → 2-快手 → 3-小红书 → 4-头条 → 5-头条2 → 6-微博 → 7-视频号 → 8-公众号 → 9-知乎 → 汇总 → 格式化 → 发飞书
  - 用途: 串行执行 9 个平台数据采集任务并汇总通知

- **头条AI测试数据爬取** (ID: `BLVEVjzdtjAPEblg`)
  - 创建时间: 2025-12-24T05:05:59.662Z
  - 最后更新: 2025-12-24T05:12:08.949Z
  - 状态: 已激活
  - 节点: 占位触发器 / 手动触发 → 执行CDP爬虫 (SSH) → 解析结果 (Code)
  - 用途: 今日头条 AI 测试账号数据采集

- **公众号数据爬取** (ID: `HegJi0788KPG1Bqh`)
  - 创建时间: 2025-12-24T05:08:17.242Z
  - 最后更新: 2025-12-24T05:12:09.425Z
  - 状态: 已激活
  - 节点: 占位触发器 / 手动触发 → 执行CDP爬虫 (SSH) → 解析结果 (Code)
  - 用途: 微信公众号数据采集

- **知乎数据爬取** (ID: `RDlBd8MRjDSICfRf`)
  - 创建时间: 2025-12-24T05:08:17.593Z
  - 最后更新: 2025-12-24T05:12:10.209Z
  - 状态: 已激活
  - 节点: 占位触发器 / 手动触发 → 执行CDP爬虫 (SSH) → 解析结果 (Code)
  - 用途: 知乎数据采集

### 更新 Workflows (6)

- **抖音数据爬取** (ID: `wxYIxt8paRz82lbW`)
  - 更新时间: 2025-12-24T04:28:34.820Z (之前: 2025-12-22T12:41:59.148Z)

- **快手数据爬取** (ID: `8YC1JuIKo0aytgQz`)
  - 更新时间: 2025-12-24T04:28:42.430Z (之前: 2025-12-22T12:55:15.335Z)

- **小红书数据爬取** (ID: `I5It7tSAT7HadXYJ`)
  - 更新时间: 2025-12-24T04:28:50.207Z (之前: 2025-12-22T12:56:37.068Z)

- **今日头条数据爬取** (ID: `SmJ3WIeVmR69l2dF`)
  - 更新时间: 2025-12-24T04:28:57.355Z (之前: 2025-12-22T12:56:43.042Z)

- **微博数据爬取** (ID: `VMS9m7rubG5zvyla`)
  - 更新时间: 2025-12-24T04:29:04.111Z (之前: 2025-12-22T12:58:10.299Z)

- **视频号数据爬取** (ID: `MnrpR0zzCaQvJ9yJ`)
  - 更新时间: 2025-12-24T04:29:14.120Z (之前: 2025-12-22T12:58:14.958Z)

---

## 2025-12-23 18:00 (Auto-sync)

无变更 - 所有 14 个 workflows 状态正常

---

## 2025-12-23

### 新增 Workflows

- **sync-workflow-changelog** (ID: `INcuVEV9PPJaQ7Yg`)
  - 创建时间: 2025-12-23T10:31:07.058Z
  - 最后更新: 2025-12-23T11:28:08.821Z
  - 状态: 已激活
  - 节点: 定时触发 → 手动触发 → 执行Claude同步 (SSH) → 解析结果 (Code) → 执行成功判断 (If) → 同步成功 (NoOp) / 飞书通知失败 (HTTP Request)
  - 用途: 自动同步 workflow 变更到 CHANGELOG

### 初始化

- 初始化 changelog
- 快照基准: 13 个平台相关 workflows (抖音/快手/小红书/今日头条/微博/视频号登录+爬取 + Claude HTTP触发器)
