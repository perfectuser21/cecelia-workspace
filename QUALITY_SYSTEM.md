---
id: quality-system-guide
version: 1.0.0
created: 2026-01-26
updated: 2026-01-26
changelog:
  - 1.0.0: 初始质检体系设置
---

# 质检体系文档

## 概述

本项目已建立完整的质检体系，包括：
- ✅ TypeScript 类型检查
- ✅ ESLint 代码规范
- ✅ Prettier 代码格式化
- ✅ Vitest 单元测试框架
- ✅ Pre-commit Hooks (Husky + lint-staged)
- ✅ GitHub Actions CI/CD

---

## 1. TypeScript 类型检查

### 配置文件
- `dashboard/tsconfig.json`

### 执行命令
```bash
cd dashboard
npm run type-check
```

### CI 集成
✅ 每次 PR/push 自动执行类型检查

### 当前状态
⚠️ `strict: false` - 计划逐步迁移到 strict 模式

---

## 2. ESLint 代码规范

### 配置文件
- `dashboard/eslint.config.js`

### 规则集
- 基于 `@zenithjoy/eslint-config`
- 自定义覆盖（迁移阶段）

### 执行命令
```bash
cd dashboard

# 检查
npm run lint

# 自动修复
npm run lint:fix
```

### CI 集成
✅ 每次 PR/push 自动执行 lint 检查

---

## 3. Prettier 代码格式化

### 配置
在 `package.json` 中配置：
```json
{
  "prettier": {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "es5",
    "printWidth": 100,
    "tabWidth": 2
  }
}
```

### 执行命令
```bash
cd dashboard

# 格式化
npm run format

# 检查格式
npm run format:check
```

### CI 集成
✅ 每次 PR/push 自动检查格式

---

## 4. Vitest 测试框架

### 配置文件
- `dashboard/vitest.config.ts`
- `dashboard/src/test/setup.ts`

### 测试命令
```bash
cd dashboard

# 运行测试（watch 模式）
npm test

# 运行测试（单次）
npm run test:run

# 测试 UI 界面
npm run test:ui

# 生成覆盖率报告
npm run test:coverage
```

### 测试覆盖率目标
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

### 测试文件位置
- 单元测试: `src/**/*.test.ts(x)`
- 集成测试: `src/**/*.spec.ts(x)`
- 测试工具: `src/test/`

### 示例测试
参考 `dashboard/src/test/example.test.tsx`

### CI 集成
✅ 每次 PR/push 自动运行测试和生成覆盖率报告

---

## 5. Pre-commit Hooks

### 工具
- Husky: Git hooks 管理
- lint-staged: 只检查暂存文件

### 配置
在 `package.json` 中配置：
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{js,jsx,json,css,md}": [
      "prettier --write"
    ]
  }
}
```

### Hook 文件
- `dashboard/.husky/pre-commit`

### 工作流程
1. `git commit` 触发
2. lint-staged 检查暂存文件
3. 自动运行 ESLint + Prettier
4. 自动修复问题
5. 如果无法自动修复，阻止提交

### 初始化
```bash
cd dashboard
npm install
npm run prepare
```

---

## 6. GitHub Actions CI/CD

### 配置文件
- `.github/workflows/ci.yml`

### CI 流程
```
PR/Push → Type Check → Lint → Format Check → Test → Coverage → Build
```

### 执行步骤
1. **Type Check**: TypeScript 类型检查
2. **Lint**: ESLint 代码规范检查
3. **Format Check**: Prettier 格式检查
4. **Test**: Vitest 单元测试
5. **Coverage**: 生成覆盖率报告
6. **Build**: Vite 生产构建

### 触发条件
- Push 到 `main` 或 `develop` 分支
- 对 `main` 或 `develop` 的 Pull Request

### 覆盖率报告
- 上传到 Codecov（可选）
- HTML 报告: `dashboard/coverage/index.html`

---

## 7. 本地开发工作流

### 开发前
```bash
cd dashboard
npm install
npm run prepare  # 初始化 Husky hooks
```

### 开发中
```bash
# 启动开发服务器
npm run dev

# 运行测试（watch 模式）
npm test
```

### 提交前
```bash
# 自动触发 pre-commit hook
git add .
git commit -m "feat: add new feature"

# Hook 会自动运行：
# 1. ESLint 检查并修复
# 2. Prettier 格式化
# 3. 如果有问题会阻止提交
```

### 提交后
```bash
# 推送到远程（触发 CI）
git push origin <branch>
```

---

## 8. 质检命令速查

| 任务 | 命令 | 说明 |
|------|------|------|
| 类型检查 | `npm run type-check` | TypeScript 类型检查 |
| Lint 检查 | `npm run lint` | ESLint 代码规范检查 |
| Lint 修复 | `npm run lint:fix` | 自动修复 ESLint 问题 |
| 格式检查 | `npm run format:check` | Prettier 格式检查 |
| 格式化 | `npm run format` | 自动格式化代码 |
| 测试 | `npm test` | 运行测试（watch） |
| 测试单次 | `npm run test:run` | 运行测试（单次） |
| 测试 UI | `npm run test:ui` | 打开测试 UI 界面 |
| 覆盖率 | `npm run test:coverage` | 生成覆盖率报告 |
| 构建 | `npm run build` | 生产构建 |
| **全量检查** | `npm run type-check && npm run lint && npm run test:run && npm run build` | 模拟 CI 流程 |

---

## 9. 故障排查

### Pre-commit Hook 不工作

```bash
cd dashboard
npm run prepare
chmod +x .husky/pre-commit
```

### 测试失败

```bash
# 清理缓存
rm -rf node_modules/.vite
rm -rf coverage

# 重新运行
npm test
```

### CI 失败

1. 查看 GitHub Actions 日志
2. 本地运行相同命令复现问题
3. 修复后重新提交

### 类型错误

```bash
# 生成类型定义
npm run type-check

# 检查 tsconfig.json 配置
```

---

## 10. 下一步计划

### 短期 (1-2 周)
- [ ] 为所有 features 添加单元测试
- [ ] 达到 80% 测试覆盖率
- [ ] 启用 TypeScript strict 模式

### 中期 (2-4 周)
- [ ] 添加 E2E 测试（Playwright）
- [ ] 性能测试（Lighthouse CI）
- [ ] 视觉回归测试（可选）

### 长期 (1-2 月)
- [ ] 自动化发布流程
- [ ] 质量看板和指标
- [ ] 持续改进质检规则

---

## 11. 相关文档

- Features 审计: `FEATURES_AUDIT.md`
- 项目配置: `CLAUDE.md`
- Feature 开发指南: 待创建
- 测试指南: 待创建

---

**建立日期**: 2026-01-26
**维护者**: Claude Sonnet 4.5
**状态**: ✅ 已完成基础设置
