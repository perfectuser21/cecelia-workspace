# Cecelia 工作流

Cecelia 是 AI 代码执行器的核心调度系统。

## 工作流清单

| 文件 | 说明 | 状态 |
|------|------|------|
| `prd-executor.json` | PRD 解析和执行调度 | ✅ 已同步 |
| `coordinator.json` | 多阶段任务协调 | 🔄 待导出 |

## prd-executor.json

**功能**: 解析 PRD 文档中的 Checkpoints，创建执行任务

**触发方式**: Webhook

**主要节点**:
1. Webhook 接收任务
2. 读取 Notion 页面获取 PRD
3. 解析 Checkpoints 列表
4. 检查依赖关系
5. 创建 Dashboard Run 记录
6. 触发 Claude Code 执行

**输入参数**:
```json
{
  "task_id": "notion-page-id",
  "project": "zenithjoy-core"
}
```

## coordinator.json (待导出)

**功能**: 监控执行状态，处理多阶段任务

**触发方式**: 执行完成回调

**主要节点**:
1. 接收执行结果
2. 判断是否多阶段任务
3. 分析执行日志
4. 创建下一阶段 PRD
5. 触发下一阶段执行

## 相关配置

- Notion Schema: `/data/cecelia/NOTION_SCHEMA.md`
- Stage Templates: `/data/cecelia/stage-templates/`

## 凭据配置

工作流使用以下 N8N 凭据（需在 N8N 中配置）:

| 凭据名 | 用途 |
|--------|------|
| `notionApi` | Notion API 访问 |
| `sshCredentials` | SSH 执行脚本 |
| `feishuWebhook` | 飞书通知 |
