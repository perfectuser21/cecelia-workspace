# 历史数据分析功能实施记录

## 实施日期
2025-12-24

## 目标
为 AI工厂-Workflow生产线 添加历史运行数据分析功能，在每次执行后统计并对比历史表现。

## 实施内容

### 1. 新建文件
- `/home/xx/dev/zenithjoy-autopilot/workflows/scripts/analyze_history.sh` (1.6K, 可执行)
  - 分析所有历史运行数据
  - 输出到 `/home/xx/data/runs/analysis.json`

### 2. 修改文件
- `/home/xx/dev/zenithjoy-autopilot/workflows/workflow-factory-final.json`
  - 从 1254 行增加到 1479 行
  - 新增 1 个节点 (44 nodes total)
  - 修改 3 个连接

### 3. 节点变更
**新增节点:**
- SSH - 更新历史分析 (ssh-analyze-history)
  - 位置: [2780, 20]
  - 运行分析脚本并返回 JSON

**修改节点:**
- Code - 生成流水线报告 (code-response)
  - 读取历史分析结果
  - 添加"历史对比"章节到报告
  - 返回 history_comparison 字段

### 4. 连接变更
**修改前:**
```
SSH - 更新CHANGELOG → HTTP - 飞书通知
```

**修改后:**
```
SSH - 更新CHANGELOG → SSH - 更新历史分析 → HTTP - 飞书通知
```

## 功能说明

### 分析脚本功能
- 统计指标：总运行次数、成功次数、总任务数、总耗时
- 计算指标：成功率、平均任务数、平均耗时
- 输出格式：JSON

### 报告增强
新增"历史对比"章节，显示：
- 历史平均耗时 vs 本次耗时
- 历史平均任务数 vs 本次任务数
- 历史成功率（总计运行次数）

## 数据依赖

分析脚本依赖以下数据结构：
```
/home/xx/data/runs/
├── {run_id}/
│   └── reports/
│       └── summary.json   ← 需包含以下字段：
│                             - quality.decision
│                             - execution.total_tasks
│                             - timeline.duration_minutes
└── analysis.json          ← 脚本输出
```

## 验证结果
所有检查项通过：
- [x] 新节点创建成功
- [x] 连接更新正确
- [x] Code 节点包含历史数据读取逻辑
- [x] 报告包含历史对比章节
- [x] 返回对象包含 history_comparison
- [x] 分析脚本存在且可执行
- [x] JSON 语法有效

## 注意事项
1. 首次运行时可能没有历史数据，报告会显示"暂无历史数据"
2. 分析脚本需要 `bc` 和 `jq` 命令，确保 VPS 已安装
3. 如果 summary.json 格式不匹配，某些统计可能为 0

## 后续优化建议
1. 添加趋势分析（最近 7 天 vs 最近 30 天）
2. 按决策类型（PASS/REWORK/FAIL）分组统计
3. 记录平均返工次数
4. 可视化历史数据（图表）
5. 异常检测（本次耗时远超平均值时告警）
