# Workflow 开发规范

## 概述

每个 Workflow 必须通过 8 路质检才能提交。

## 8 路质检

```bash
./scripts/quality-check.sh {workflow.json} \
  --n8n-id {id} \
  --bundle {name}
```

### 检查项

| # | 检查 | 通过条件 |
|---|------|----------|
| 1 | 硬检查 | Workflow 存在于 n8n |
| 2 | 软检查 | 总分 ≥ 80，每项 ≥ 12 |
| 3 | 安全扫描 | 无敏感信息泄露 |
| 4 | 集成检查 | n8n API 连接正常 |
| 5 | 性能检查 | 节点数 ≤ 30，连接数 ≤ 50 |
| 6 | Git 检查 | 无合并冲突 |
| 7 | Linting | JSON 有效，字段完整 |
| 8 | 测试覆盖率 | 复杂 Workflow 需有测试文件 |

### 软检查 5 维度

| 维度 | 满分 | 检查内容 |
|------|------|----------|
| completeness | 20 | 有触发器、处理节点、输出 |
| error_handling | 20 | 有错误处理、通知机制 |
| naming | 20 | 无默认名称、使用中文 |
| parameters | 20 | 参数完整、无硬编码 |
| best_practices | 20 | 使用凭据、节点数合理 |

**通过条件**: 总分 ≥ 80 且每项 ≥ 12

## 返工机制

```
质检失败
    ↓
第 1 次返工
├── 收集失败原因
├── 修复问题
└── 重新质检
    ↓
仍失败 → 第 2 次返工
    ↓
仍失败 → 停止
├── 写执行报告（详细失败原因）
├── Status = Waiting
└── 等待人工处理
```

## 执行报告格式

任务完成后，在 Task Page Content 末尾追加：

```markdown
---

## 执行报告

### 执行结果：✅ 成功 / ❌ 失败

### 做了什么
- 创建了 {workflow_name}.json
- 更新了 bundle.json（v1.0.0 → v1.0.1）
- 部署到 n8n（ID: xxx）

### 遇到的问题
- 无 / 或具体描述

### 解决方法
- 无 / 或具体描述

### 经验/建议
- （对未来有价值的经验）

### 相关文件
- bundles/{bundle_name}/{workflow_name}.json
- bundles/{bundle_name}/bundle.json

### 质检结果
- 硬检查：✅
- 软检查：85/100
- 安全扫描：✅
- 集成检查：✅
- 性能检查：✅
- Git 检查：✅
- Linting：✅
- 测试覆盖率：✅
```

## 经验记录

### 什么算通用经验

- 踩过的坑（下次要避免）
- 发现的最佳实践
- 可复用的模式/模板
- 外部 API/工具的注意事项

### 不需要记录

- 只适用于这一个任务的细节
- 已经在执行报告里写过的常规问题

### 记录方式

```bash
/home/xx/bin/notion-task-reporter.sh create-note \
  --name "[n8n] 经验标题" \
  --content "详细内容" \
  --task-id "{task_id}"
```

### 记录格式

```
Name: [模块名] 经验 - 简短描述
Project Type: Experience
Projects: 关联到对应项目
Tasks: 关联到这个任务
```

## Workflow 文件规范

### 必需字段

```json
{
  "name": "中文名称",
  "nodes": [...],
  "connections": {...},
  "settings": {
    "executionOrder": "v1"
  }
}
```

### 节点命名

- 使用中文名称
- 描述功能而非类型
- 避免 "Code 1", "HTTP Request 2" 等默认名

### 凭据使用

```json
{
  "credentials": {
    "sshPrivateKey": {
      "id": "vvJsQOZ95sqzemla",
      "name": "VPS SSH Key"
    }
  }
}
```

**已有凭据 ID**:
- SSH: `vvJsQOZ95sqzemla`

### 布局规范

- 节点水平间距: 240px
- 节点垂直间距: 200px
- 触发器在最左侧
- 流程从左到右

## 安全规范

### 禁止硬编码

- 密码
- API Key
- Token
- 私钥

### 应该使用

- n8n 凭据
- 环境变量
- 表达式引用

## 测试文件

复杂 Workflow（节点数 > 4）建议添加测试：

```
workflows/tests/{bundle_name}/{workflow_name}.test.json
```

---

## 更新记录

| 日期 | 变更描述 |
|------|----------|
| 2025-12-26 | 初始创建：定义质检规则、返工机制、报告格式 |
| 2025-12-26 | 添加 quality-check.sh 8 路质检详细说明 |
| 2025-12-26 | 添加软检查 5 维度评分标准 |
