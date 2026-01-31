# Intent Recognition - 自然语言→OKR/Project/Task

## 功能说明

Intent Recognition（意图识别）模块是 Cecelia Workspace 的核心 AI 能力之一，实现了将自然语言输入转换为结构化的 OKR/Project/Task 实体。

### 核心能力

1. **意图分类**：识别用户输入是要创建任务（Task）、目标（Goal）还是项目（Project）
2. **实体提取**：从自然语言中提取关键信息（标题、描述、优先级、时间范围等）
3. **置信度评估**：对识别结果给出 0-1 之间的置信度分数
4. **多语言支持**：支持中文和英文输入

### 技术特点

- 基于规则的实现，不依赖复杂的 NLP 模型
- 短语模式匹配 + 关键词匹配的混合策略
- 支持优先级、时间范围、依赖关系等多种实体类型
- 响应时间 < 500ms (p95)

## API 使用示例

### 基本用法

```bash
# 识别任务创建意图
curl -X POST http://localhost:5212/api/brain/intent/parse \
  -H "Content-Type: application/json" \
  -d '{"input": "帮我做个登录功能"}'

# 响应
{
  "success": true,
  "type": "task",
  "entities": {
    "title": "登录功能",
    "description": "帮我做个登录功能",
    "priority": null,
    "timeframe": null,
    "module": null,
    "feature": "登录功能",
    ...
  },
  "confidence": 0.7,
  "_meta": {
    "responseTime": 15,
    "confidenceLevel": "high",
    "originalIntentType": "create_feature",
    "keywords": ["做", "功能"],
    "matchedPhrases": ["帮我做一个(.+)"]
  }
}
```

### 目标（Goal）识别

```bash
curl -X POST http://localhost:5212/api/brain/intent/parse \
  -H "Content-Type: application/json" \
  -d '{"input": "创建一个 P0 目标：提升系统稳定性"}'

# 响应
{
  "type": "goal",
  "entities": {
    "title": "提升系统稳定性",
    "priority": "P0",
    ...
  },
  "confidence": 0.85
}
```

### 项目（Project）识别

```bash
curl -X POST http://localhost:5212/api/brain/intent/parse \
  -H "Content-Type: application/json" \
  -d '{"input": "开始一个新的电商项目"}'

# 响应
{
  "type": "project",
  "entities": {
    "title": "电商项目",
    ...
  },
  "confidence": 0.75
}
```

### 带优先级和时间范围

```bash
curl -X POST http://localhost:5212/api/brain/intent/parse \
  -H "Content-Type: application/json" \
  -d '{"input": "紧急任务：今天修复购物车 bug"}'

# 响应
{
  "type": "task",
  "entities": {
    "title": "修复购物车 bug",
    "priority": "P0",
    "timeframe": "今天",
    ...
  },
  "confidence": 0.8
}
```

## 支持的短语模式

### 任务（Task）创建

- 中文：
  - "帮我做个..."
  - "添加一个...功能"
  - "实现...接口"
  - "写一个..."
  - "修复...bug"

- 英文：
  - "add ... feature"
  - "implement ..."
  - "fix ... bug"
  - "create ... task"

### 目标（Goal）创建

- 中文：
  - "创建...目标"
  - "设定...目标"
  - "目标：..."
  - "我想完成..."

- 英文：
  - "create ... goal"
  - "set ... objective"
  - "goal: ..."

### 项目（Project）创建

- 中文：
  - "我想做一个..."
  - "开发...系统"
  - "搭建...平台"
  - "创建...项目"

- 英文：
  - "build a ..."
  - "create ... project"
  - "develop ... system"
  - "set up ..."

## 实体提取规则

### 优先级（Priority）

自动识别以下关键词并映射到标准优先级：

| 关键词 | 映射优先级 |
|--------|----------|
| P0, 高优先级, 高优, 紧急, urgent, critical | P0 |
| P1, 中优先级, 中优, 普通, normal | P1 |
| P2, 低优先级, 低优, low priority | P2 |

### 时间范围（Timeframe）

识别时间相关关键词：

- 今天 / today
- 明天 / tomorrow
- 本周 / this week
- 下周 / next week
- 本月 / this month
- 尽快 / ASAP

### 其他实体

- **模块（Module）**：识别 "...模块"、"...系统"、"...平台"、"...服务"
- **功能（Feature）**：识别 "...功能"、"...特性"
- **文件路径（FilePath）**：识别 `src/...`、`apps/...`、`*.js`、`*.ts` 等
- **API 端点（ApiEndpoint）**：识别 `/api/...`、`POST /...`、`GET /...`
- **组件（Component）**：识别 React 组件名（大写开头）
- **依赖（Dependency）**：识别 "依赖..."、"阻塞于..."、"depends on ..."

## 置信度分级

| 置信度范围 | 等级 | 说明 |
|-----------|------|------|
| >= 0.7 | high | 高置信度，匹配到明确的短语模式 |
| 0.4 - 0.7 | medium | 中等置信度，匹配到部分关键词 |
| < 0.4 | low | 低置信度，可能识别错误 |

## 扩展方法

### 添加新的短语模式

在 `apps/core/src/brain/intent.js` 中修改 `INTENT_PHRASES` 对象：

```javascript
const INTENT_PHRASES = {
  [INTENT_TYPES.CREATE_TASK]: [
    { pattern: /添加(.+)任务/, weight: 0.4 },
    { pattern: /创建(.+)任务/, weight: 0.4 },
    // 添加新模式
    { pattern: /帮我搞定(.+)/, weight: 0.3 },
    ...
  ]
};
```

### 添加新的实体类型

在 `ENTITY_PATTERNS` 中添加新的实体提取规则：

```javascript
const ENTITY_PATTERNS = {
  // 添加新实体类型
  assignee: [
    /@(\\w+)/,              // @username
    /分配给(.+)/,
    /assign to (.+)/i
  ],
  ...
};
```

然后在 `extractEntities` 函数中添加提取逻辑：

```javascript
function extractEntities(input) {
  const entities = {
    assignee: null,  // 添加新字段
    ...
  };

  // 提取 assignee
  for (const pattern of ENTITY_PATTERNS.assignee) {
    const match = input.match(pattern);
    if (match) {
      entities.assignee = match[1].trim();
      break;
    }
  }

  return entities;
}
```

### 修改意图分类逻辑

如果需要添加新的意图类型，需要修改三个地方：

1. **定义意图类型**（`INTENT_TYPES`）：
```javascript
const INTENT_TYPES = {
  CREATE_CUSTOM: 'create_custom',  // 添加新类型
  ...
};
```

2. **添加关键词和短语**（`INTENT_KEYWORDS` 和 `INTENT_PHRASES`）
3. **更新 API 映射**（`apps/core/src/brain/routes.js` 中的 `typeMap`）：
```javascript
const typeMap = {
  'create_custom': 'custom',  // 添加映射
  ...
};
```

## 性能优化建议

1. **输入长度限制**：默认限制 10,000 字符，避免性能问题
2. **缓存优化**：对于相同输入可以考虑缓存结果（当前未实现）
3. **正则优化**：避免过于复杂的正则表达式，影响匹配性能

## 测试

运行单元测试：

```bash
npm test -- apps/core/src/brain/__tests__/intent.test.js
```

运行 API 集成测试：

```bash
npm test -- apps/core/src/routes/api/__tests__/intent.test.ts
```

## 限制和已知问题

1. **不支持多轮对话**：只处理单次输入，不保存上下文
2. **不支持复杂语义**：基于规则，无法理解复杂的语义关系
3. **中文支持优先**：英文支持较为基础
4. **无歧义消解**：对于模糊输入无法主动询问用户澄清

## 相关文件

- 核心实现：`apps/core/src/brain/intent.js`
- API 路由：`apps/core/src/brain/routes.js`
- 单元测试：`apps/core/src/brain/__tests__/intent.test.js`
- API 测试：`apps/core/src/routes/api/__tests__/intent.test.ts`（待创建）

## 版本历史

- v1.0.0 (2026-02-01): 初始版本，实现 KR1 意图识别核心功能
  - 意图分类（task/goal/project）
  - 实体提取（title/priority/timeframe等）
  - API 端点 `/api/brain/intent/parse`
  - 置信度评估（high/medium/low）
