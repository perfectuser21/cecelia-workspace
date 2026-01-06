# Instance 版本管理

## 概念说明

```
Git 分支/标签     →  管理「代码版本」（features、workflows、dashboard）
Instance stack   →  管理「客户配置」（启用哪些 feature、版本锁定）
```

## 版本策略

### Git 分支

| 分支 | 用途 | 谁用 |
|------|------|------|
| `main` | 开发分支 | 开发者 |
| `stable` | 稳定分支 | 客户团队 |

### Git 标签

格式：`v{major}.{minor}.{patch}`

```bash
# 打标签（发布新版本时）
git tag v1.0.0
git push origin v1.0.0

# 查看所有标签
git tag -l
```

### Instance Stack 版本

每个 instance 的 `stack.yml` 中记录使用的功能版本：

```yaml
instance: zenithjoy
stack_version: 1.0.0          # 整体配置版本

features:
  ai-factory:
    version: 1.4.0            # 锁定的 feature 版本
    enabled: true
```

## 工作流程

### 1. 日常开发

```bash
# 在 main 分支开发
git checkout main
# ... 开发新功能 ...
git commit -m "feat: xxx"
```

### 2. 发布稳定版

```bash
# 1. 确认 main 稳定
# 2. 更新 stack.yml 中的版本号
# 3. 打标签
git tag v1.1.0
git push origin v1.1.0

# 4. 更新 stable 分支
git checkout stable
git merge main
git push origin stable
```

### 3. 客户团队更新

```bash
# 客户拉取 stable 分支
git checkout stable
git pull origin stable
```

### 4. 紧急修复（Hotfix）

```bash
# 从 stable 分支修复
git checkout stable
git checkout -b hotfix/xxx
# ... 修复 ...
git checkout stable
git merge hotfix/xxx
git tag v1.0.1

# 同步回 master
git checkout master
git merge stable
```

## Instance 目录结构

```
instances/
├── _template/           # 新客户模板
│   ├── stack.yml
│   └── notes.md
├── zenithjoy/           # 悦升云端（自己公司）
│   ├── stack.yml
│   └── deploy/
├── dad/                 # 爸爸公司
│   └── stack.yml
└── {new-client}/        # 新客户（复制 _template）
```

## 版本号规则

- **Major (1.x.x)**: 重大架构变更、不兼容更新
- **Minor (x.1.x)**: 新功能、兼容性更新
- **Patch (x.x.1)**: Bug 修复、小改动

## 快速参考

```bash
# 查看当前版本
git describe --tags

# 查看版本历史
git tag -l -n

# 客户当前用哪个版本？
cat instances/{client}/stack.yml | grep stack_version
```
