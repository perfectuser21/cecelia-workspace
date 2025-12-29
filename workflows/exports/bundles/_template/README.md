# Feature Name

> 一句话描述这个 Feature 的用途

## 功能

- 功能点 1
- 功能点 2
- 功能点 3

## 组件

| 组件 | 文件 | 说明 |
|------|------|------|
| main-workflow | main.json | 主工作流 |

## 依赖

- 无 / 或列出依赖的 shared 模块

## 配置

| 配置项 | 必须 | 说明 |
|--------|------|------|
| EXAMPLE_API_KEY | 是 | 示例 API 密钥 |

## 使用方法

```bash
# 调用示例
curl -X POST "https://xxx.app.n8n.cloud/webhook/feature-name" \
  -H "Content-Type: application/json" \
  -d '{"param": "value"}'
```

## 更新历史

见 manifest.yml 的 changelog
