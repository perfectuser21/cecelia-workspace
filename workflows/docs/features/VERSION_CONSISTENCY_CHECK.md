# 版本一致性检查 (Version Consistency Check)

## 概述

版本一致性检查是 AI工厂-Workflow生产线 的第 6 文件版本检查功能,解决痛点 #9：版本混乱问题。

## 功能

自动检查项目中多个文件的版本号是否一致，包括：

### 检查的文件

1. **VERSION** - 版本文件
2. **package.json** - npm 包配置
3. **CHANGELOG.md** - 变更日志（提取首个版本号）
4. **settings.json** - 设置文件
5. **manifest.yml / manifest.yaml** - 清单文件
6. **SPEC.yaml** - 规格文件
7. **workflow*.json** - Workflow JSON 文件
8. ***-factory*.json** - Factory JSON 文件

## 实现位置

### 函数定义

`/home/xx/bin/workflow-factory.sh` 第 964-1104 行

```bash
check_version_consistency() {
  # 检查所有版本文件
  # 生成 version.json 报告
}
```

### 调用位置

1. **QC 检查阶段** - Git 检查部分（第 1201-1206 行）
2. **决策阶段** - 版本一致性决策（第 1272-1286 行）
3. **摘要报告** - QC 结果汇总（第 1552 行）

## 输出格式

### version.json

```json
{
  "check": "version_consistency",
  "files_checked": ["VERSION", "package.json", "CHANGELOG.md"],
  "versions_found": {
    "VERSION": "1.2.3",
    "package.json": "1.2.3",
    "CHANGELOG.md": "1.2.3"
  },
  "consistent": true,
  "pass": true,
  "issues": []
}
```

### 版本不一致时

```json
{
  "check": "version_consistency",
  "files_checked": ["VERSION", "package.json", "CHANGELOG.md"],
  "versions_found": {
    "VERSION": "1.2.3",
    "package.json": "1.2.4",
    "CHANGELOG.md": "1.2.5"
  },
  "consistent": false,
  "pass": false,
  "issues": [
    "版本不一致: package.json (1.2.4) != VERSION (1.2.3)",
    "版本不一致: CHANGELOG.md (1.2.5) != VERSION (1.2.3)"
  ]
}
```

## 版本提取规则

### VERSION 文件
直接读取文件内容，去除空白字符

### package.json
提取 `.version` 字段

### CHANGELOG.md
匹配第一个出现的版本号：
- 格式：`## [1.2.3]` 或 `## 1.2.3`
- 正则：`##\s*\[?\K[0-9]+\.[0-9]+\.[0-9]+`

### settings.json
提取 `.version` 字段

### manifest.yml / SPEC.yaml
提取 `version:` 字段的值

### Workflow JSON
尝试提取 `.version` 或 `.meta.version`

## 集成流程

```
run_qc_checks()
  ↓
7.6 Git检查
  ↓
check_version_consistency() ← 调用版本检查
  ↓
生成 version.json
  ↓
Git检查读取 version.json
  ↓
更新 git_check.version_ok
  ↓
make_decision()
  ↓
检查 version.json.pass
  ↓
版本不一致 → decision=REWORK
  ↓
generate_summary()
  ↓
包含 qc.version 在摘要报告中
```

## 决策影响

### 版本一致
- `pass: true`
- 不影响决策，继续流程

### 版本不一致
- `pass: false`
- 决策：`REWORK`（如果不是 FAIL）
- 记录问题：`issues += "版本不一致"`
- 日志输出：具体版本冲突详情

## 测试

### 测试脚本

`/tmp/direct_test_version.sh`

### 测试用例

1. **一致版本测试**
   - VERSION: 1.2.3
   - package.json: 1.2.3
   - CHANGELOG.md: 1.2.3
   - 结果：✓ PASS

2. **不一致版本测试**
   - VERSION: 1.2.3
   - package.json: 1.2.4
   - CHANGELOG.md: 1.2.5
   - 结果：✓ 正确检测到不一致

## 使用示例

### 手动调用

```bash
STATE_DIR="/home/xx/data/runs/test_run_123"
WORKFLOW_DIR="/home/xx/dev/zenithjoy-autopilot/workflows"

mkdir -p "$STATE_DIR/qc"

# Source the script
source /home/xx/bin/workflow-factory.sh

# Call the function
cd "$WORKFLOW_DIR"
check_version_consistency

# Check result
cat "$STATE_DIR/qc/version.json" | jq '.'
```

### 在 Workflow Factory 中自动执行

版本检查会在每次运行时自动执行，无需手动调用。

## 注意事项

1. **文件不存在**：如果某个文件不存在，会跳过该文件
2. **版本格式**：支持标准语义化版本号格式 (X.Y.Z)
3. **空版本**：如果所有文件都没有版本号，标记为不一致
4. **首个版本**：以第一个找到的版本号为基准

## 相关文件

- `/home/xx/bin/workflow-factory.sh` - 主脚本
- `$STATE_DIR/qc/version.json` - 检查结果
- `$STATE_DIR/qc/git.json` - Git 检查（包含 version_ok 字段）
- `$STATE_DIR/reports/summary.json` - 摘要报告

## 更新日志

- **2025-12-25**: 初始实现，集成到 workflow-factory.sh
  - 添加 check_version_consistency() 函数
  - 集成到 QC 流程
  - 添加决策逻辑
  - 添加摘要报告
  - 完成测试验证
