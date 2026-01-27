# 版本管理与 QA 系统集成分析

> 分析 VERSIONING.md（版本管理）与 /qa Skill（质量保证）的联动关系
>
> 创建时间：2026-01-27
> 状态：🚧 设计阶段

---

## 1. 现状分析

### 1.1 版本管理系统（VERSIONING.md）

**位置**：`/home/xx/dev/cecelia-workspace/VERSIONING.md`

**职责**：
- 定义 Semver 规则（MAJOR.MINOR.PATCH）
- 定义 commit 类型与版本变更的映射关系
- 定义独立版本管理策略（每个 app 独立版本）
- 定义 CHANGELOG 更新流程

**规则**：
```
fix:      → patch (+0.0.1)
feat:     → minor (+0.1.0)
feat!:    → major (+1.0.0)
BREAKING: → major (+1.0.0)
```

**当前功能**：
- ✅ 版本号变更规则明确
- ✅ CHANGELOG 格式标准化（Keep a Changelog）
- ✅ 独立版本管理策略清晰
- ❌ 未定义版本变更与测试的关系
- ❌ 未定义版本变更与 RCI 的触发策略

---

### 1.2 QA 系统（/qa Skill）

**位置**：`~/.claude/skills/qa/SKILL.md`

**职责**：
- 跨仓库 QA 总控（Engine + Business repos）
- 管理测试决策（测试计划、RCI 判定、Golden Path 判定）
- 管理回归契约（regression-contract.yaml）
- 管理 Feature 归类（FEATURES.md）

**核心概念**：
1. **测试分类**：Regression / Unit / E2E
2. **RCI (Regression Contract Items)**：回归契约项，定义"绝不能坏"的功能
3. **Golden Paths**：E2E 的结构化组合（关键用户路径）
4. **优先级映射**：CRITICAL→P0, HIGH→P1, MEDIUM→P2, LOW→P3

**当前功能**：
- ✅ RCI 判定规则明确（NO_RCI / MUST_ADD_RCI / UPDATE_RCI）
- ✅ Golden Path 判定规则明确
- ✅ 优先级映射规则明确
- ✅ 5 种模式支持（测试计划、GP 判定、RCI 判定、Feature 归类、QA 审计）
- ❌ regression-contract.yaml 在 cecelia-workspace 中**不存在**
- ❌ 未定义版本变更触发的测试策略

---

### 1.3 FEATURES.md（能力地图）

**位置**：`/home/xx/dev/cecelia-workspace/FEATURES.md`

**职责**：
- 定义 Feature 能力地图（What，人读）
- 使用 DDD 三层分类（Foundation/Business/Platform）
- 定义 RCI 契约字段（如 RCI-F-001, RCI-B-001）
- 定义 Golden Path 字段（如 GP-AUTH-001, GP-MEDIA-001）
- 定义依赖关系和优先级

**统计**：
- 总计 12 个 Features，30 个子功能
- 75% Features 有 RCI 契约
- 50% Features 有 Golden Path
- P0: 4 个，P1: 6 个，P2: 2 个

**当前功能**：
- ✅ Feature 分类明确
- ✅ RCI 契约字段已定义（文本形式）
- ✅ Golden Path 字段已定义（文本形式）
- ❌ RCI 契约**没有对应的 regression-contract.yaml 执行文件**
- ❌ Golden Path **没有对应的测试执行机制**

---

### 1.4 /dev Workflow（开发工作流）

**位置**：`~/.claude/skills/dev/steps/`

**集成点**：

#### Step 4: DoD（QA Decision Node）
- **输入**：PRD, DoD 草稿, 改动类型
- **输出**：`docs/QA-DECISION.md`
- **内容**：
  ```yaml
  Decision: NO_RCI | MUST_ADD_RCI | UPDATE_RCI
  Priority: P0 | P1 | P2
  Tests: [测试方法和位置]
  RCI: {new: [], update: []}
  ```

#### Step 7: Quality（Audit Node）
- **输入**：本次改动的文件
- **输出**：`docs/AUDIT-REPORT.md`
- **内容**：
  ```yaml
  Decision: PASS | FAIL
  Summary: {L1: 0, L2: 0, L3: 0, L4: 0}
  Findings: [问题列表]
  Blockers: [阻塞性问题]
  ```

**质检分层**：
- **L1**: 自动化测试 (npm run qa)
- **L2A**: 代码审计 (Audit Node)
- **L2B**: Evidence 证据 (截图/curl)
- **L3**: Acceptance 验收 (DoD 全勾)
- **L4**: 过度优化 (识别但不修)

**当前功能**：
- ✅ QA Decision Node 集成在 Step 4
- ✅ Audit Node 集成在 Step 7
- ✅ PR Gate 检查产物存在性
- ✅ Stop Hook 强制质检通过
- ❌ 版本变更与测试策略**没有联动**

---

## 2. 缺失的集成点

### 2.1 regression-contract.yaml 缺失

**问题**：
- FEATURES.md 定义了 RCI 契约字段（如 RCI-F-001）
- /qa Skill 明确说明 regression-contract.yaml 是"全量回归的唯一合法定义来源"
- 但在 cecelia-workspace 中**不存在** regression-contract.yaml

**影响**：
- ✅ RCI 判定规则已定义（/qa Skill）
- ✅ RCI 契约字段已定义（FEATURES.md）
- ❌ RCI 契约**无法执行**（没有 yaml 文件）
- ❌ 无法触发回归测试

**期望**：
```yaml
# regression-contract.yaml (应该存在)
regression_contract_items:
  - id: RCI-F-001
    desc: "飞书登录必须可用"
    priority: P0
    trigger: [PR, Release]
    test_cmd: "npm run test -- tests/auth.test.ts"

  - id: RCI-B-001
    desc: "小红书采集功能不能中断"
    priority: P0
    trigger: [PR, Release]
    test_cmd: "npm run test -- tests/media/scraping.test.ts"

golden_paths:
  - id: GP-AUTH-001
    desc: "用户扫码 → 授权 → 获取 Token → 进入系统"
    rcis: [RCI-F-001, RCI-F-002, RCI-F-003]
    trigger: [Release, Nightly]
```

---

### 2.2 版本变更与测试策略未联动

**问题**：
- VERSIONING.md 定义了 commit 类型 → 版本变更
- /qa Skill 定义了测试触发策略（PR / Release / Nightly）
- 但两者**没有明确的联动规则**

**当前状况**：
```
用户提交代码:
  git commit -m "feat: add login feature"
    ↓
  VERSIONING.md → minor 版本升级 (+0.1.0)
    ↓
  /dev Step 4 → QA Decision Node → 输出 QA-DECISION.md
    ↓
  /dev Step 7 → Audit Node + npm run qa
    ↓
  PR 创建 → CI 运行
    ↓
  ? 什么时候触发 RCI？
  ? feat: 需要跑 Golden Path 吗？
  ? fix: 可以跳过某些 RCI 吗？
```

**期望的联动规则**（建议）：

| Commit 类型 | 版本变更 | 触发测试 | RCI 策略 | Golden Path |
|------------|---------|---------|---------|------------|
| `fix:` | patch | L1 (npm run qa) | P0/P1 RCI | 不触发 |
| `feat:` | minor | L1 + L2A | P0/P1/P2 RCI | 触发相关 GP |
| `feat!:` | major | L1 + L2A + L2B | 全部 RCI | 触发全部 GP |
| `docs:` | 无 | 不触发 | 不触发 | 不触发 |
| `chore:` | 无 | 不触发 | 不触发 | 不触发 |

**P0/P1 强制 RCI 更新**：
- 根据 /qa Skill 规则：P0/P1 的修复必须更新 regression-contract.yaml
- 当前由 `require-rci-update-if-p0p1.sh` 强制检查（但在 cecelia-workspace 中可能不存在）

---

### 2.3 Golden Path 执行机制缺失

**问题**：
- FEATURES.md 定义了 Golden Path 字段（如 GP-AUTH-001）
- /qa Skill 定义了 Golden Path 判定规则
- 但**没有实际的测试执行机制**

**当前状况**：
```
FEATURES.md 定义:
  GP-AUTH-001: 用户扫码 → 授权 → 获取 Token → 进入系统
    ↓
  ? 这个 GP 对应哪个测试文件？
  ? 什么时候触发这个 GP？
  ? 如何执行这个 GP？
```

**期望**：
```yaml
# regression-contract.yaml
golden_paths:
  - id: GP-AUTH-001
    desc: "用户扫码 → 授权 → 获取 Token → 进入系统"
    rcis: [RCI-F-001, RCI-F-002, RCI-F-003]
    test_cmd: "npm run test:e2e -- tests/e2e/auth-flow.test.ts"
    trigger: [Release, Nightly]
```

---

### 2.4 CHANGELOG 与 RCI 同步机制缺失

**问题**：
- VERSIONING.md 要求更新 CHANGELOG 记录变更
- /qa Skill 要求 P0/P1 变更更新 RCI
- 但两者**没有同步机制**

**期望**：
```markdown
# CHANGELOG.md
## [1.1.0] - 2026-01-27

### Added
- 飞书登录功能 (RCI-F-001)
- 小红书采集功能 (RCI-B-001)

### Fixed
- 修复登录跳转问题 (RCI-F-001)
```

每个 CHANGELOG 条目应该引用对应的 RCI ID。

---

## 3. 建议的集成方案

### 3.1 创建 regression-contract.yaml

**位置**：`/home/xx/dev/cecelia-workspace/regression-contract.yaml`

**内容结构**（参考 /qa Skill 规范）：
```yaml
# ZenithJoy Workspace Regression Contract
version: 1.0.0
repo_type: Workspace
updated: 2026-01-27

regression_contract_items:
  # Foundation Features
  - id: RCI-F-001
    desc: "飞书登录必须可用"
    priority: P0
    feature: F-AUTH
    trigger: [PR, Release]
    test_cmd: "npm run test -- tests/auth/feishu-login.test.ts"

  - id: RCI-F-002
    desc: "Token 刷新机制不能失效"
    priority: P0
    feature: F-AUTH
    trigger: [PR, Release]
    test_cmd: "npm run test -- tests/auth/token-refresh.test.ts"

  # Business Features
  - id: RCI-B-001
    desc: "小红书采集功能不能中断"
    priority: P0
    feature: F-MEDIA-COLLECT
    trigger: [PR, Release]
    test_cmd: "npm run test -- tests/media/xiaohongshu-scraping.test.ts"

  - id: RCI-B-002
    desc: "采集数据格式必须保持一致"
    priority: P0
    feature: F-MEDIA-COLLECT
    trigger: [PR, Release]
    test_cmd: "npm run test -- tests/media/data-format.test.ts"

golden_paths:
  - id: GP-AUTH-001
    desc: "用户扫码 → 授权 → 获取 Token → 进入系统"
    feature: F-AUTH
    rcis: [RCI-F-001, RCI-F-002, RCI-F-003]
    test_cmd: "npm run test:e2e -- tests/e2e/auth-flow.test.ts"
    trigger: [Release, Nightly]

  - id: GP-MEDIA-001
    desc: "采集 → 保存 → 发布完整流程"
    feature: F-MEDIA
    rcis: [RCI-B-001, RCI-B-002, RCI-B-003, RCI-B-004]
    test_cmd: "npm run test:e2e -- tests/e2e/media-workflow.test.ts"
    trigger: [Release, Nightly]
```

**生成策略**：
- 从 FEATURES.md 提取所有 `has_rci: true` 的 Features
- 将 RCI 契约文本转换为 YAML 格式
- 将 Golden Path 文本转换为 YAML 格式
- 映射到实际的测试文件路径（如果存在）

---

### 3.2 更新 VERSIONING.md 集成测试策略

**在 VERSIONING.md 中新增章节**：

```markdown
## 版本变更与测试策略

### 触发规则

| Commit 类型 | 版本变更 | 必须通过的测试 | 触发 RCI | 触发 Golden Path |
|------------|---------|---------------|---------|-----------------|
| `fix:` | patch (+0.0.1) | L1 (npm run qa) | P0/P1 | 不触发 |
| `feat:` | minor (+0.1.0) | L1 + L2A | P0/P1/P2 | 触发相关 GP |
| `feat!:` / `BREAKING:` | major (+1.0.0) | L1 + L2A + L2B + L3 | 全部 RCI | 触发全部 GP |
| `docs:` / `style:` / `refactor:` / `test:` / `chore:` | 无 | 不触发 | 不触发 | 不触发 |

### 测试命令

```bash
# L1: 自动化测试（所有 PR 必须通过）
npm run qa  # typecheck + test + build

# L2A: 代码审计（通过 /dev Step 7 Audit Node）
# 自动生成 docs/AUDIT-REPORT.md

# 触发 RCI（根据 commit 类型和优先级）
bash scripts/rc-filter.sh pr       # PR 阶段：P0/P1
bash scripts/rc-filter.sh release  # Release 阶段：全部 RCI

# 触发 Golden Path（Release 或 Nightly）
npm run test:e2e
```

### 强制 RCI 更新规则

- **P0/P1 修复必须更新 regression-contract.yaml**
- 由 PR Gate 检查：`bash scripts/require-rci-update-if-p0p1.sh`
- 优先级检测：`node scripts/detect-priority.cjs`

### CHANGELOG 引用 RCI

```markdown
## [1.1.0] - 2026-01-27

### Added
- 飞书登录功能 (RCI-F-001, RCI-F-002)
- 小红书采集功能 (RCI-B-001, RCI-B-002)

### Fixed
- 修复登录跳转问题 (影响 RCI-F-001)
```
```

---

### 3.3 更新 /dev Workflow 集成版本检测

**在 Step 4 (DoD) 增强 QA Decision Node**：

```markdown
## Step 4.2: QA Decision Node（必须）

### 输入
- PRD (.prd.md)
- DoD 草稿
- 改动类型（feature/bugfix/refactor）
- **Commit 类型** (fix: / feat: / feat!:)  ← 新增
- **版本变更** (patch / minor / major)    ← 新增

### 输出 Schema
```yaml
Decision: NO_RCI | MUST_ADD_RCI | UPDATE_RCI
Priority: P0 | P1 | P2
RepoType: Engine | Business
VersionImpact: patch | minor | major  ← 新增
TestStrategy:                         ← 新增
  - L1: true
  - L2A: true
  - L2B: false  # major 才触发
  - L3: false   # major 才触发
  - RCI: [RCI-F-001, RCI-B-001]      # 需要触发的 RCI
  - GP: [GP-AUTH-001]                 # 需要触发的 GP

Tests:
  - dod_item: "功能描述"
    method: auto | manual
    location: tests/xxx.test.ts | manual:描述
    rci_id: RCI-F-001  ← 新增（如果有）

RCI:
  new: [RCI-F-004]      # 需要新增的 RCI
  update: [RCI-F-001]   # 需要更新的 RCI

Reason: 一句话说明决策理由
```
```

**在 Step 7 (Quality) 增强测试执行**：

```markdown
## Step 7.3: 跑测试 (L1)

根据 QA-DECISION.md 中的 TestStrategy 执行：

```bash
# L1: 自动化测试（必须）
npm run qa

# 触发 RCI（如果 TestStrategy.RCI 非空）
if [ -n "$RCI_LIST" ]; then
  bash scripts/rc-filter.sh pr
fi

# 触发 Golden Path（如果 TestStrategy.GP 非空）
if [ -n "$GP_LIST" ]; then
  npm run test:e2e -- --gp="$GP_LIST"
fi
```
```

---

### 3.4 创建辅助脚本

#### scripts/rc-filter.sh（RCI 过滤执行）

```bash
#!/bin/bash
# RCI 过滤执行脚本
# 根据 stage 和 priority 过滤 regression-contract.yaml

STAGE=$1  # pr | release | nightly

case $STAGE in
  pr)
    # PR 阶段：只跑 P0/P1 RCI
    yq '.regression_contract_items[] | select(.priority == "P0" or .priority == "P1") | .test_cmd' regression-contract.yaml | xargs -I {} bash -c "{}"
    ;;
  release)
    # Release 阶段：跑所有 RCI + Golden Path
    yq '.regression_contract_items[] | .test_cmd' regression-contract.yaml | xargs -I {} bash -c "{}"
    yq '.golden_paths[] | .test_cmd' regression-contract.yaml | xargs -I {} bash -c "{}"
    ;;
  nightly)
    # Nightly 阶段：只跑 Golden Path
    yq '.golden_paths[] | .test_cmd' regression-contract.yaml | xargs -I {} bash -c "{}"
    ;;
esac
```

#### scripts/detect-priority.cjs（优先级检测）

```javascript
// 从 commit message 或 PR title 检测优先级
// 参考 /qa Skill 的映射规则

const message = process.argv[2];

let priority = 'P2'; // 默认

if (message.match(/^(security:|security\(.*\):)/)) {
  priority = 'P0';
} else if (message.match(/^(fix:|feat!:|BREAKING:)/)) {
  priority = 'P1';
} else if (message.match(/^feat:/)) {
  priority = 'P2';
}

console.log(priority);
```

#### scripts/require-rci-update-if-p0p1.sh（RCI 更新检查）

```bash
#!/bin/bash
# 检查 P0/P1 修复是否更新了 regression-contract.yaml

PRIORITY=$1  # P0 | P1 | P2

if [ "$PRIORITY" == "P0" ] || [ "$PRIORITY" == "P1" ]; then
  # 检查 regression-contract.yaml 是否在本次 commit 中修改
  if ! git diff --name-only HEAD~1 | grep -q "regression-contract.yaml"; then
    echo "❌ P0/P1 修复必须更新 regression-contract.yaml"
    exit 1
  fi
fi

echo "✅ RCI 更新检查通过"
```

---

## 4. 实施步骤

### Phase 1: 创建 regression-contract.yaml
- [ ] 从 FEATURES.md 提取 RCI 契约
- [ ] 从 FEATURES.md 提取 Golden Path
- [ ] 创建 regression-contract.yaml
- [ ] 映射到实际测试文件路径（如果存在）

### Phase 2: 更新 VERSIONING.md
- [ ] 新增"版本变更与测试策略"章节
- [ ] 定义触发规则表格
- [ ] 定义测试命令
- [ ] 定义 CHANGELOG 引用 RCI 规范

### Phase 3: 增强 /dev Workflow
- [ ] 更新 Step 4 (DoD) 的 QA Decision Node Schema
- [ ] 更新 Step 7 (Quality) 的测试执行逻辑
- [ ] 集成版本检测和 RCI 触发

### Phase 4: 创建辅助脚本
- [ ] 创建 scripts/rc-filter.sh
- [ ] 创建 scripts/detect-priority.cjs
- [ ] 创建 scripts/require-rci-update-if-p0p1.sh
- [ ] 添加到 package.json scripts

### Phase 5: CI/CD 集成
- [ ] 更新 GitHub Actions workflow
- [ ] 集成 RCI 过滤执行
- [ ] 集成优先级检测
- [ ] 集成 RCI 更新强制检查

---

## 5. 后续优化

### 5.1 自动化 RCI 生成
- 根据 FEATURES.md 自动生成 regression-contract.yaml
- 避免手动维护两份文档

### 5.2 测试覆盖率监控
- 监控 RCI 覆盖率（已有测试 / 总 RCI）
- 监控 Golden Path 覆盖率

### 5.3 RCI 执行报告
- 每次 CI 运行后生成 RCI 执行报告
- 记录哪些 RCI 通过，哪些失败

### 5.4 版本发布自动化
- 根据 commit 类型自动更新版本号
- 自动更新 CHANGELOG
- 自动创建 git tag
- 自动触发对应的测试策略

---

## 6. 总结

### 核心问题

用户的问题："版本管理体系和 Cecelia 的 quality 怎么联动？按理说 Quality 应该在他那边管呀"

**答案**：

1. **当前状态**：
   - VERSIONING.md 管理版本号变更规则（commit → version）
   - /qa Skill 管理测试决策规则（RCI 判定、GP 判定）
   - **两者是独立的**，没有明确的联动规则

2. **缺失的集成**：
   - ❌ regression-contract.yaml 不存在（无法执行 RCI）
   - ❌ 版本变更不触发测试策略（fix: 跑什么？feat: 跑什么？）
   - ❌ Golden Path 无执行机制
   - ❌ CHANGELOG 与 RCI 不同步

3. **建议方案**：
   - ✅ 创建 regression-contract.yaml（从 FEATURES.md 生成）
   - ✅ 在 VERSIONING.md 中定义版本变更 → 测试策略映射
   - ✅ 增强 /dev Workflow 的 QA Decision Node 和 Quality 步骤
   - ✅ 创建辅助脚本（rc-filter.sh, detect-priority.cjs）
   - ✅ 集成到 CI/CD

4. **最终效果**：
   ```
   用户提交 feat: commit
       ↓
   VERSIONING.md → minor 版本升级
       ↓
   /dev Step 4 → QA Decision Node → TestStrategy: {L1, L2A, RCI: [P0/P1/P2], GP: [相关]}
       ↓
   /dev Step 7 → npm run qa + rc-filter.sh pr + test:e2e --gp
       ↓
   PR 创建 → CI 执行相应测试 → 合并
       ↓
   CHANGELOG 更新 → 引用相关 RCI
   ```

### 质量保证的归属

**用户关注**："按理说 Quality 应该在他那边管"

**解答**：
- **/qa Skill** 是质量保证的**决策中心**（判断跑什么测试、RCI 是否需要）
- **VERSIONING.md** 是版本管理的**规则中心**（判断版本怎么变）
- **/dev Workflow** 是**执行中心**（在 Step 4/7 调用 QA 和 Audit）
- **regression-contract.yaml** 是**测试定义中心**（定义 RCI 和 GP 如何执行）

**正确的架构**：
```
Quality 决策 (/qa Skill)
    ↓
版本规则 (VERSIONING.md) + 测试定义 (regression-contract.yaml)
    ↓
执行编排 (/dev Workflow)
    ↓
实际执行 (CI/CD + npm scripts)
```

Quality 确实应该由 /qa Skill 管理，但需要通过 regression-contract.yaml 和 VERSIONING.md 联动到实际执行。

---

## 附录

### A. 相关文件位置

| 文件 | 位置 | 状态 |
|------|------|------|
| VERSIONING.md | `/home/xx/dev/cecelia-workspace/VERSIONING.md` | ✅ 已存在 |
| /qa Skill | `~/.claude/skills/qa/SKILL.md` | ✅ 已存在 |
| FEATURES.md | `/home/xx/dev/cecelia-workspace/FEATURES.md` | ✅ 已存在 |
| regression-contract.yaml | `/home/xx/dev/cecelia-workspace/regression-contract.yaml` | ❌ 需创建 |
| /dev Step 4 | `~/.claude/skills/dev/steps/04-dod.md` | ✅ 已存在 |
| /dev Step 7 | `~/.claude/skills/dev/steps/07-quality.md` | ✅ 已存在 |
| rc-filter.sh | `/home/xx/dev/cecelia-workspace/scripts/rc-filter.sh` | ❌ 需创建 |
| detect-priority.cjs | `/home/xx/dev/cecelia-workspace/scripts/detect-priority.cjs` | ❌ 需创建 |

### B. 参考资料

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- `/qa Skill` - 测试决策规范
- `/dev Workflow` - 开发工作流规范
- `FEATURES.md` - Feature 能力地图

---

**文档状态**：🚧 设计阶段，等待用户反馈和确认
