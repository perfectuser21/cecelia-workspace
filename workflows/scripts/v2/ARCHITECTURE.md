# AI 工厂 v2 架构文档

## 概述

AI 工厂 v2 是一个自动化任务执行系统，通过 n8n workflow 触发，调用 Claude Code 执行各类编码任务。

## 当前状态

- ✅ 主控框架完成 (main.sh)
- ✅ n8n 执行器完成 (n8n/execute.sh)
- ⏳ Backend 执行器待实现 (backend/execute.sh)
- ⏳ Frontend 执行器待实现 (frontend/execute.sh)

---

## 整体架构

```
n8n Workflow (webhook 触发)
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                    main.sh (主控)                    │
│  - 锁管理 (防并发)                                    │
│  - 4 阶段调度: prepare → execute → quality → cleanup │
│  - 失败重试 (MAX_RETRIES=2)                          │
│  - 稳定性验证 (STABILITY_RUNS=3)                     │
│  - 整体重试 (FULL_RETRY_MAX=1)                       │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────┬─────────┬─────────┬─────────┐
│ prepare │ execute │ quality │ cleanup │
│  准备   │  执行   │  质检   │  收尾   │
└─────────┴─────────┴─────────┴─────────┘
```

---

## 4 阶段详解

### 阶段 1: prepare.sh (准备)

**职责**:
1. 创建运行目录 `/home/xx/data/runs/{run_id}/`
2. 检查 Git 状态（必须干净）
3. 创建 feature 分支
4. 从 Notion 读取任务详情
5. 保存环境变量到 env.sh

**输入**: task_id, coding_type, run_id
**输出**: task_info.json, env.sh

### 阶段 2: execute.sh (执行) ⭐ 核心

**职责**: 根据 coding_type 调用不同的执行器

| coding_type | 执行器 | 状态 |
|-------------|--------|------|
| n8n | n8n/execute.sh | ✅ 已完成 |
| backend | backend/execute.sh | ⏳ 待实现 |
| frontend | frontend/execute.sh | ⏳ 待实现 |

**输入**: run_id, task_info.json
**输出**: result.json, workflow.json (或代码文件)

### 阶段 3: quality-check.sh (质检)

**职责**:
1. 运行各项检查（文件存在、语法、安全、Git 状态）
2. 生成 HTML 质检报告
3. 截图保存

**输入**: run_id, coding_type
**输出**: quality_result.json, report.html, screenshots/

### 阶段 4: cleanup.sh (收尾)

**职责**:
1. Git add/commit/push
2. 更新 Notion 状态
3. 发送飞书通知
4. 上传截图到 Notion
5. 清理旧运行目录

**输入**: run_id, task_id, passed (bool)
**输出**: 最终状态更新

---

## 执行器架构

### 当前问题

n8n/execute.sh 有 629 行，其中约 60-70% 是通用逻辑：
- 参数解析
- 环境加载
- 稳定性验证跳过
- Claude 调用框架
- 结果 JSON 生成
- 截图功能

### 重构方案

提取公共逻辑到 `shared/execute-base.sh`：

```
shared/
  execute-base.sh      # 公共逻辑 (~200行)
  utils.sh             # 工具函数
  screenshot-utils.sh  # 截图工具
  quality-check.sh     # 质检
  cleanup.sh           # 收尾
  prepare.sh           # 准备

n8n/execute.sh         # source base + n8n 特有逻辑
backend/execute.sh     # source base + backend 特有逻辑
frontend/execute.sh    # source base + frontend 特有逻辑
```

### execute-base.sh 内容

```bash
# 公共部分
- 参数解析 (run_id, task_info_path)
- 加载 utils.sh, screenshot-utils.sh
- 加载 env.sh
- 稳定性验证跳过逻辑
- check_disk_space()
- html_escape()

# Claude 调用框架
- build_prompt() - 由各执行器实现
- call_claude() - 通用调用逻辑
- parse_claude_output() - 由各执行器实现

# 结果处理
- generate_result_json()
- take_screenshots()
```

---

## 各执行器特有逻辑

### n8n/execute.sh (已完成)

**特有功能**:
1. 模板匹配 (监控告警/数据抓取等模板)
2. 生成 Workflow JSON
3. 调用 n8n REST API 创建/激活 workflow
4. 导出 workflow 到 exports/

**Claude Prompt 重点**:
- 生成符合 n8n 格式的 workflow JSON
- 使用正确的节点类型和连接

**质检重点**:
- workflow.json 存在且有效
- nodes 数量 > 0
- 无合并冲突

### backend/execute.sh (待实现)

**特有功能**:
1. 分析 PRD 确定要创建/修改的文件
2. 生成 TypeScript/Python 代码
3. 写入文件到项目目录
4. 运行测试 (npm test / pytest)
5. 运行 lint 检查

**Claude Prompt 重点**:
- 读取现有代码结构
- 遵循项目代码风格
- 生成可运行的代码

**质检重点**:
- 文件已创建/修改
- TypeScript 编译通过
- 测试通过
- 无 lint 错误

### frontend/execute.sh (待实现)

**特有功能**:
1. 分析 PRD 确定组件/页面
2. 生成 React/Vue 组件代码
3. 写入文件
4. 运行构建 (npm run build)
5. 可选: 截图预览

**Claude Prompt 重点**:
- 遵循组件库风格 (如 Tailwind)
- 正确导入依赖
- 响应式设计

**质检重点**:
- 组件文件已创建
- 构建成功
- 无 TypeScript 错误
- 无未使用的导入

---

## 目录结构

```
/home/xx/dev/zenithjoy-autopilot/workflows/scripts/v2/
├── main.sh                 # 主控脚本
├── .gitignore
├── ARCHITECTURE.md         # 本文档
│
├── shared/                 # 共享模块
│   ├── utils.sh            # 通用工具函数
│   ├── screenshot-utils.sh # 截图工具
│   ├── prepare.sh          # 准备阶段
│   ├── quality-check.sh    # 质检阶段
│   ├── cleanup.sh          # 收尾阶段
│   └── execute-base.sh     # 执行器公共逻辑 (待创建)
│
├── n8n/                    # n8n 执行器
│   └── execute.sh          # ✅ 已完成 (629行)
│
├── backend/                # Backend 执行器
│   └── execute.sh          # ⏳ 待实现 (当前空壳)
│
└── frontend/               # Frontend 执行器
    └── execute.sh          # ⏳ 待实现 (当前空壳)
```

---

## 运行目录结构

每次运行创建:
```
/home/xx/data/runs/{run_id}/
├── env.sh              # 环境变量
├── task_info.json      # Notion 任务信息
├── workflow.json       # (n8n) 生成的 workflow
├── result.json         # 执行结果
├── quality_result.json # 质检结果
├── logs/
│   ├── execute.log
│   ├── quality.log
│   └── stability.log
└── screenshots/
    ├── n8n-execute-result.png
    └── quality-report.png
```

---

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| TEST_MODE | 0 | 测试模式，跳过真实 API 调用 |
| MAX_RETRIES | 2 | 单阶段最大重试次数 |
| STABILITY_RUNS | 3 | 稳定性验证次数 |
| FULL_RETRY_MAX | 1 | 整体重试次数 |
| RETRY_DELAY | 2 | 重试间隔(秒) |

### Secrets (.secrets 文件)

```
N8N_REST_API_KEY=xxx
NOTION_API_KEY=xxx
FEISHU_BOT_WEBHOOK=xxx
IMGBB_API_KEY=xxx (可选，用于截图上传)
```

---

## 下一步工作

1. **创建 execute-base.sh**: 从 n8n/execute.sh 提取公共逻辑
2. **重构 n8n/execute.sh**: 改为 source execute-base.sh + 特有逻辑
3. **实现 backend/execute.sh**: 代码生成 + 测试运行
4. **实现 frontend/execute.sh**: 组件生成 + 构建检查
5. **更新 quality-check.sh**: 支持 backend/frontend 的质检项

---

## 调用示例

```bash
# 测试模式运行
TEST_MODE=1 ./main.sh "task-123" n8n

# 生产模式运行 (由 n8n webhook 触发)
./main.sh "notion-page-id" backend

# 压力测试
./stress-test.sh
```

---

## 已完成的优化 (5轮审计)

- 信号处理 (SIGINT/SIGTERM/SIGHUP)
- 锁管理 (防死锁、权限控制)
- JSON 注入防护 (jq 构建)
- XSS 防护 (html_escape)
- API 超时和重试
- 磁盘空间检查
- 环境变量安全
- 函数导出完整性

**压力测试结果**: 10/10 通过，成功率 100%
