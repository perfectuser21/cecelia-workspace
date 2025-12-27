# n8n Workflow 项目

## 开发原则

- 通过 MCP 直接创建/修改 workflow，不导出让用户导入
- 每个节点测试通过后才汇报
- 遇到问题先解决，不跳过

---

## 快速查表

### 平台抓取 (Windows node)

所有抓取逻辑在 VPS，Windows 只维护登录态。

| 平台 | 外部 CDP 端口 | 内部端口 |
|------|--------------|----------|
| 抖音 | 19222 | 9222 |
| 快手 | 19223 | 9223 |
| 小红书 | 19224 | 9224 |
| 头条主号 | 19225 | 9225 |
| 头条副号 | 19226 | 9226 |
| 微博 | 19227 | 9227 |
| 视频号 | 19228 | 9228 |
| 公众号 | 19229 | 9229 |
| 知乎 | 19230 | 9230 |

**端口规则**: 外部端口 = 内部端口 + 10000

### AI 工厂 Workflows

| 名称 | ID | 用途 | Webhook | 状态 |
|------|-----|------|---------|------|
| AI工厂-Workflow生产线-v2 | VQSeOX886lchEATW | 根据 PRD 创建/修改 n8n workflow (6节点简化版，调用主控脚本) | `/webhook/workflow-factory` | 已激活 ✅ |
| AI工厂-基座生产线 | cIFvRTzOAxk7GA06 | 根据 PRD 创建代码库（18节点，多 Claude 并行，4路质检） | `/webhook/codebase-factory` | 已激活 ✅ |

### 内容发布 Workflow

| 名称 | ID | 用途 | Webhook | 状态 |
|------|-----|------|---------|------|
| 内容发布 | vdOQoapL3yB5CD52 | Dashboard 一键发布到 9 个平台 | `/webhook/content-publish` | 已激活 ✅ |

**支持的平台**: douyin, kuaishou, xiaohongshu, toutiao-main, toutiao-sub, weibo, shipinhao, gongzhonghao, zhihu

**流程**:
```
Dashboard → Webhook → 逐平台循环 → SSH 调用 vps_publisher.js → 回调 Dashboard → 飞书通知
```

**调用方式**:
```bash
# Dashboard 自动调用，也可手动测试
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/content-publish" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "xxx",
    "title": "测试内容",
    "content": "内容描述",
    "mediaType": "video",
    "targetPlatforms": ["douyin", "kuaishou"]
  }'
```

### 监控 Workflows

| 名称 | ID | 用途 | 调度 | 状态 |
|------|-----|------|------|------|
| 监控巡逻 | 0qLCksKGKxShGcYH | 每6小时巡检VPS健康状态（网站、SSL、磁盘、内存、容器、CDP端口） | 00:00/06:00/12:00/18:00 UTC | 已激活 ✅ |

### 夜间维护 Workflows

| 名称 | ID | 用途 |
|------|-----|------|
| 夜间调度器 | g1fYgIGWViVuqK7u | 每日 19:00 UTC (03:00 北京) 串行执行子 workflow |
| 夜间健康检查 | wqeeHpnTcJolnse4 | 子 workflow: 磁盘/容器/内存检查 |
| 夜间备份 | 70DVZ55roILCGAMM | 子 workflow: 备份配置和脚本 |
| 夜间清理 | wOg5NRZ2yx0D18nY | 子 workflow: 清理临时文件和 Docker |

### 其他 Workflows

| 名称 | ID | 用途 |
|------|-----|------|
| Claude HTTP 触发 | Ar2BwcAElSsexIKC | HTTP 触发 Claude（备用） |
| Workflow 同步 | INcuVEV9PPJaQ7Yg | 每日 02:00 同步 workflow 变更到 CHANGELOG |

---

## 配置

### n8n Cloud

```
Server: https://zenithjoy21xx.app.n8n.cloud
MCP: https://zenithjoy21xx.app.n8n.cloud/mcp-server/http
API Keys: 见 .secrets
```

### VPS

```
Host: 146.190.52.84
User: xx
SSH Key: ~/.ssh/id_rsa
```

### Windows node (瘦客户端)

**设计原则**: 所有脚本在 VPS，Windows 只维护登录态

```
Tailscale IP: 100.97.242.124
CDP 端口: 19222-19230 (内部 9222-9230)
File Receiver: 3001
```

**Windows 只需要**:
- 9 个 Chrome 实例（保持登录）
- `file-receiver.js`（接收发布文件）
- Tailscale 连接

**VPS 脚本（所有逻辑）**:
```bash
# 发布
node ~/vps_publisher.js <taskId> <platform>

# 抓取
node ~/vps_scraper.js <platform>
```

---

## 架构

```
VPS (所有逻辑)                        Windows node (瘦客户端)
┌─────────────────────┐              ┌─────────────────────┐
│ vps_scraper.js      │              │                     │
│ vps_publisher.js    │──Tailscale──▶│ 9 个 Chrome 实例     │
│                     │  CDP:19222   │ (只保持登录态)       │
│ 抓取逻辑            │   ~19230     │                     │
│ 发布逻辑            │              │ file-receiver.js    │
│ 数据处理            │──HTTP:3001──▶│ (接收发布文件)       │
└─────────────────────┘              └─────────────────────┘
        ↓
  Dashboard API
```

**优点**:
- 脚本集中在 VPS，维护方便
- Windows 换机器只需登录账号
- 调试日志全在 VPS

---

## API 调用

### n8n REST API

```bash
# 获取 workflow
curl -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/{id}

# 更新 workflow
curl -X PATCH -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"nodes": [...]}' \
  https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/{id}

# 激活/停用 workflow
curl -X PATCH -H "X-N8N-API-KEY: $N8N_REST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' \
  https://zenithjoy21xx.app.n8n.cloud/api/v1/workflows/{id}
```

### Keys 配置

在 `.secrets` 文件：
- `N8N_REST_API_KEY` - REST API 密钥
- `N8N_MCP_API_KEY` - MCP Server 密钥
- `SSH_CREDENTIAL_ID: vvJsQOZ95sqzemla` - SSH 凭据 ID
- `FEISHU_BOT_WEBHOOK` - 飞书通知 Webhook

---

## n8n 启动 Claude

```bash
# n8n SSH 节点执行此命令
cd /home/xx/dev/{repo} && claude -p "{prompt}" --allowedTools "..." 2>&1
```

执行器 Workflow: `3hhrCpZtQjnAmJAz`

---

## 数据库

### content_items（作品 + 最新指标）

```
id, platform, content_type, title, publish_time, status
latest_views, latest_likes, latest_comments, latest_shares, latest_favorites
```

### content_metrics（历史快照）

```
content_id, days_after_publish (1,2,3,5,7,15,30)
views, likes, comments, shares, favorites
completion_rate, bounce_rate, profile_visits, follower_gain
```

---

## API

```bash
# 后台
https://dashboard.zenjoymedia.media:3000

# 批量保存数据
POST http://localhost:3333/api/platform-data/batch
```

---

## 夜间调度系统

**主调度器**: `g1fYgIGWViVuqK7u` | 每日 19:00 UTC (03:00 北京)

```
03:00 触发 → 健康检查 → 备份 → 清理 → 汇总结果
                                        ↓
                              有失败？→ 飞书告警
```

**子 Workflows**:
| 任务 | ID | 说明 |
|------|-----|------|
| 健康检查 | wqeeHpnTcJolnse4 | 磁盘/容器/内存 |
| 备份 | 70DVZ55roILCGAMM | session/脚本/报告，保留 7 天 |
| 清理 | wOg5NRZ2yx0D18nY | /tmp/docker/Chrome缓存 |

**报告目录**: `~/maintenance-reports/`

---

## 通知规则

**时间控制**（北京时间）:
- 07:30 - 18:30 → 飞书通知
- 其他时间 → 写入 Notion，不打扰

**通知条件**: 重试 2 次后仍失败才通知

**飞书 Webhook**: 见 .secrets `FEISHU_BOT_WEBHOOK`

---

## Claude 模型规则

- **默认使用 sonnet**，不用 haiku
- n8n 启动的无头 Claude 统一用 sonnet

---

## AI 工厂 Headless 配置

### 进程管理

AI 工厂调用 Claude Code 时使用以下机制防止僵尸进程：

```bash
# 超时强杀：超时后 10 秒强制 SIGKILL
timeout -k 10 120 claude -p "$prompt" ...

# 脚本退出时自动清理子进程
trap 'cleanup_processes' EXIT
```

### 会话记录分离

Headless 任务的会话记录与开发记录分开存放：

| 类型 | 工作目录 | 记录位置 |
|------|---------|---------|
| 开发会话 | `/home/xx/dev/zenithjoy-autopilot/workflows` | `~/.claude/projects/-home-xx-dev-n8n-workflows/` |
| Headless | `/home/xx/data/factory-workspace` | `~/.claude/projects/-home-xx-data-factory-workspace/` |

**实现方式**：
```bash
# Headless 在专用目录运行，通过 --add-dir 访问项目文件
cd "$HEADLESS_WORKSPACE" && claude -p "$prompt" --add-dir "$WORKFLOW_DIR" ...
```

### 清理历史记录

```bash
# 清理 headless 会话记录
patterns="你是 n8n 架构师|分解PRD|执行以下任务|workflow 任务列表"
grep -l -E "$patterns" ~/.claude/projects/*/*.jsonl | xargs rm -f

# 清理僵尸进程
pkill -u $(whoami) -f "claude.*-p"
```

---

## AI 工厂使用说明

### Workflow 生产线

用于创建/修改 n8n workflow。

```bash
# 调用方式
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "创建一个每小时检查 VPS 磁盘空间的 workflow，超过 80% 发飞书告警",
    "project": "monitoring"
  }'

# 修改现有 workflow
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/workflow-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "给这个 workflow 添加重试逻辑",
    "target_workflow": "wqeeHpnTcJolnse4"
  }'
```

### 基座生产线

用于创建/修改代码库。采用 10 节点流水线设计：

```
接收PRD → 分解任务(Claude A) → 拓扑排序 → 批量执行(Claude B) → 合并结果
    ↓
4路并行质检（硬检查/软检查/版本检查/安全扫描）→ 决策 → 文档生成(Claude D) → 飞书通知
```

**核心特性**:
- 三角色分离：Claude A(架构师) ≠ B(工程师) ≠ C(审查员) ≠ D(文档员)
- 硬检查用 Bash（文件存在性、TS 语法、安全扫描）
- 软检查用 Claude（代码质量、最佳实践）
- 拓扑排序自动处理任务依赖关系
- SplitInBatches 实现任务并行执行

```bash
# 调用方式
curl -X POST "https://zenithjoy21xx.app.n8n.cloud/webhook/codebase-factory" \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "添加一个 API 端点 GET /api/health，返回服务状态",
    "projectPath": "/home/xx/dev/n8n-social-media-scraper"
  }'
```

### 工厂执行流程

```
Webhook 接收 PRD
    ↓
生成 run_id
    ↓
SSH 调用 Claude Code 无头模式
    ↓
Claude 执行任务（MCP 操作 workflow / 写代码）
    ↓
解析结果
    ↓
飞书通知 + 返回 JSON
```

---

## AI 工厂分析

### 历史数据分析

```bash
# 完整分析脚本
/home/xx/bin/analyze-factory-history.sh [--days N] [--format json|md|both] [--output DIR]

# 快捷命令
factory-stats today     # 今日运行统计
factory-stats week      # 最近 7 天
factory-stats month     # 最近 30 天
factory-stats all       # 全部历史
factory-stats show      # 查看最新报告
factory-stats json      # JSON 输出（适合自动化）
```

**分析内容**:
- 成功率、失败率、未完成率
- 平均耗时、任务数、重做次数
- 模型使用分布（opus/sonnet/haiku）
- 任务复杂度分布（1-5 级）
- 常见失败原因
- 成本估算
- 可靠性和效率评分
- 优化建议

**报告位置**: `/home/xx/dev/zenithjoy-autopilot/workflows/analytics/`

详细文档: `ANALYTICS_GUIDE.md`

---

## 里程碑

- 2025-12-21: n8n Cloud → SSH → Claude 链路打通
- 2025-12-22: 6 平台爬取系统上线
- 2025-12-23: 数据库重构、爬虫优化
- 2025-12-24:
  - 修复夜间维护系统
  - 新建调度器 + 3 个子 workflow（健康检查/备份/清理）
  - 创建 AI 工厂：Workflow生产线 + 基座生产线
- 2025-12-25:
  - 清理重复的 AI 工厂 workflows（从 53 个减到 22+2 个）
  - 创建 AI 工厂历史数据分析系统
  - **迁移到 Windows 架构**：VPS 控制 + Windows 登录态，删除 VNC 容器
  - **创建内容发布系统**：Dashboard → n8n → vps_publisher.js → 9 平台自动发布
- 2025-12-26:
  - **修复 Headless 进程泄漏**：添加 timeout -k 强杀 + 退出清理
  - **会话记录分离**：Headless 记录存到专用目录，不污染开发记录
  - **迁移到新 Windows 机器 (node)**：100.97.242.124，替换 ROG
