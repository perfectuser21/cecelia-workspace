# AI工厂-Workflow生产线

## 概览

完整的 10 节点 n8n workflow，实现三角色分离的自动化 workflow 生产流程。

## Workflow 信息

- **ID**: `4Ie84ecbq1866yMC`
- **状态**: 已激活
- **Webhook URL**: `http://localhost:5679/webhook/workflow-factory`
- **创建时间**: 2025-12-24

## 架构设计

### 核心原则

1. **三角色分离**: 执行者 ≠ 检查者
2. **硬检查优先**: 用纯 JS/Bash 进行存在性、版本、安全检查
3. **并行处理**: 使用 SplitInBatches 实现任务并行执行

### 10 节点结构

```
接收PRD (Webhook)
  ↓
SSH Claude A - 分解PRD
  ↓
Code - 拓扑排序
  ↓
SplitInBatches - 任务分批 ⟷ SSH Claude B - 执行任务 (循环)
  ↓
Code - 合并结果
  ↓
╔═══════════════════════════════╗
║   4 路并行质检               ║
║  ┌─────────────────────────┐ ║
║  │ Bash 硬检查 - 存在性    │ ║
║  │ Claude C 软检查 - 质量  │ ║
║  │ Code - 版本一致性       │ ║
║  │ Bash - 安全扫描         │ ║
║  └─────────────────────────┘ ║
╚═══════════════════════════════╝
  ↓
Code - 决策 (If 节点)
  ↓
SSH Claude D - 生成文档
  ↓
HTTP - 飞书通知
```

## 节点说明

### 1. 接收PRD (Webhook)
- **类型**: n8n-nodes-base.webhook
- **路径**: `workflow-factory`
- **方法**: POST
- **输入**: `{"prd": "需求文档内容"}`

### 2. SSH Claude A - 分解PRD
- **角色**: 分解者
- **工具**: Read, Write, Edit, Grep, Glob, Bash
- **输出**: JSON 格式的任务列表，包含依赖关系

### 3. Code - 拓扑排序
- **类型**: 纯 JS 节点
- **功能**: 将任务按依赖关系排成波次（waves）
- **算法**: 拓扑排序，检测循环依赖

### 4. SplitInBatches - 任务分批
- **类型**: n8n-nodes-base.splitInBatches
- **批次大小**: 1
- **输出**: 第一个输出连接到 SSH Claude B，第二个输出连接到 Code - 合并结果

### 5. SSH Claude B - 执行任务
- **角色**: 执行者
- **工具**: mcp__n8n (search/get/execute), Read, Write, Edit, Bash
- **输出**: `{"task_id": "xxx", "status": "success/failed", "workflow_id": "xxx", "nodes_created": 5}`

### 6. Code - 合并结果
- **类型**: 纯 JS 节点
- **功能**: 合并所有任务执行结果，计算成功率

### 7. 并行质检（4 路）

#### 7.1 Bash 硬检查 - Workflow存在性
- **类型**: SSH Bash
- **功能**: 通过 n8n REST API 验证 workflow 是否存在，节点数量是否正确

#### 7.2 Claude C 软检查 - Workflow质量
- **角色**: 检查者（与执行者分离）
- **检查项**: 命名规范、错误处理、日志记录、连接完整性

#### 7.3 Code - 版本一致性检查
- **类型**: 纯 JS 节点
- **功能**: 确保所有 workflow 使用相同版本的节点

#### 7.4 Bash 安全扫描
- **类型**: SSH Bash
- **功能**: 检查硬编码的密钥、密码等敏感信息

### 8. Code - 决策
- **类型**: n8n-nodes-base.if
- **条件**: 所有 4 个质检都通过
- **输出**:
  - True → 生成文档
  - False → 直接通知（跳过文档生成）

### 9. SSH Claude D - 生成文档
- **角色**: 文档生成者
- **工具**: mcp__n8n__get_workflow_details, Write, Edit
- **输出**: `/home/xx/dev/zenithjoy-autopilot/workflows/workflow-factory-output.md`

### 10. HTTP - 飞书通知
- **类型**: n8n-nodes-base.httpRequest
- **格式**: 飞书交互式卡片
- **内容**: 执行摘要 + 质检结果

## 使用方法

### 调用示例

```bash
curl -X POST http://localhost:5679/webhook/workflow-factory \
  -H "Content-Type: application/json" \
  -d '{
    "prd": "创建一个简单的数据清洗 workflow，包含以下功能：\n1. 接收 CSV 文件\n2. 去除重复行\n3. 填充空值\n4. 导出到数据库"
  }'
```

### 输入格式

```json
{
  "prd": "PRD 文档内容（支持 Markdown）"
}
```

### 输出格式（飞书通知）

```
Workflow 生产完成 ✅

执行摘要
- 总任务数: 3
- 成功: 3
- 失败: 0
- 成功率: 100%

质检结果
- 存在性检查: ✅ 通过
- 质量检查: ✅ 通过
- 版本一致性: ✅ 通过
- 安全扫描: ✅ 通过
```

## 配置信息

### SSH 凭据
- **ID**: `vvJsQOZ95sqzemla`
- **名称**: VPS SSH Key
- **主机**: 146.190.52.84
- **用户**: xx

### n8n REST API
- **Base URL**: http://localhost:5679/api/v1
- **API Key**: (在 Bash 节点中硬编码，需要从环境变量读取)

### 飞书 Webhook
- **URL**: https://open.feishu.cn/open-apis/bot/v2/hook/5bde68e0-9879-4a45-88ed-461a88229136

## 工作流程

1. **接收 PRD** → Webhook 接收 POST 请求
2. **分解任务** → Claude A 将 PRD 分解为独立任务（带依赖）
3. **拓扑排序** → 纯 JS 将任务排成波次
4. **批量执行** → SplitInBatches + Claude B 循环执行任务
5. **合并结果** → 纯 JS 汇总所有任务结果
6. **4 路质检** → 并行执行硬检查和软检查
7. **决策判断** → 所有质检通过才进入下一步
8. **生成文档** → Claude D 为所有 workflow 生成文档
9. **发送通知** → 飞书卡片通知结果

## 注意事项

1. **Claude 模型**: 所有 Claude 调用统一使用 `sonnet`
2. **超时设置**: SSH 节点默认超时 2 分钟，复杂任务可能需要调整
3. **并发控制**: SplitInBatches 批次大小为 1，保证串行执行
4. **安全性**:
   - API Key 硬编码在 Bash 节点中，建议迁移到环境变量
   - 安全扫描会检测敏感信息泄露
5. **工作目录**: 所有 Claude 调用在 `/home/xx/dev/zenithjoy-autopilot/workflows` 目录执行

## 文件

- **Workflow JSON**: `/home/xx/dev/zenithjoy-autopilot/workflows/workflow-factory-v2.json`
- **输出文档**: `/home/xx/dev/zenithjoy-autopilot/workflows/workflow-factory-output.md` (自动生成)
- **说明文档**: `/home/xx/dev/zenithjoy-autopilot/workflows/AI-FACTORY-README.md` (本文件)

## 下一步优化

1. **环境变量化**: 将 API Key 从硬编码迁移到环境变量
2. **错误重试**: 为 SSH 节点添加重试机制
3. **进度追踪**: 添加中间状态保存，支持断点续传
4. **并行优化**: SplitInBatches 支持同一波次任务并行执行
5. **日志收集**: 将所有 Claude 执行日志保存到文件

## 更新日志

- **2025-12-24**: 初始版本创建，10 节点完整流程实现并激活
