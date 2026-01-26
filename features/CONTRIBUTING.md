# Contributing to Features

## 开发流程

### 1. 开始新 Feature

```bash
# 创建分支
git checkout -b feature/my-feature-name

# 创建 feature 目录
mkdir -p features/my-feature/{pages,components,api,hooks}

# 创建 manifest
touch features/my-feature/index.ts
```

### 2. 实现 Feature

按照 [README.md](./README.md) 中的指南实现功能。

### 3. 测试

```bash
cd dashboard

# 类型检查
npm run type-check

# Lint 检查
npm run lint

# 构建测试
npm run build

# 运行测试
npm run test

# 本地运行
npm run dev
```

### 4. 提交代码

```bash
# 添加更改
git add features/my-feature/

# 提交（遵循 Conventional Commits）
git commit -m "feat(my-feature): add initial implementation"

# 推送
git push origin feature/my-feature-name
```

### 5. 创建 Pull Request

- PR 标题: `feat(my-feature): brief description`
- PR 描述: 说明功能、测试方法、截图
- 确保 CI 通过

---

## 代码规范

### Commit Message 格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

**Scope**: Feature 名称，例如 `canvas`, `cecelia`, `vps-monitor`

**示例**:

```
feat(canvas): add mermaid diagram support

- Integrated mermaid.js for flowchart rendering
- Added MermaidRenderer component
- Updated canvas tools definition

Closes #123
```

### TypeScript 规范

```typescript
// ✅ 使用接口定义类型
interface User {
  id: string;
  name: string;
}

// ✅ 导出类型
export interface MyFeatureData {
  items: string[];
}

// ✅ 使用 Readonly 保护不可变数据
const CONFIG: Readonly<Config> = { ... };

// ❌ 避免 any
function process(data: any) { }  // Bad

// ✅ 使用具体类型
function process(data: MyFeatureData) { }  // Good
```

### React 组件规范

```typescript
// ✅ 使用函数组件 + Hooks
export default function MyComponent() {
  const [state, setState] = useState<string>('');

  useEffect(() => {
    // 副作用
  }, []);

  return <div>{state}</div>;
}

// ✅ 使用 TypeScript 类型
interface Props {
  title: string;
  onClose: () => void;
}

export default function MyComponent({ title, onClose }: Props) {
  return <div>{title}</div>;
}

// ✅ 使用 default export
export default function MyComponent() { ... }

// ❌ 避免命名导出作为主组件
export function MyComponent() { ... }  // Bad for pages
```

### CSS / Tailwind 规范

```typescript
// ✅ 使用 Tailwind utility classes
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <h1 className="text-2xl font-bold text-gray-900">Title</h1>
</div>

// ✅ 条件类名
<div className={`
  p-4 rounded
  ${isActive ? 'bg-blue-500' : 'bg-gray-200'}
  ${large ? 'text-xl' : 'text-sm'}
`}>
  Content
</div>

// ❌ 避免内联样式
<div style={{ padding: '16px' }}>Bad</div>

// ❌ 避免自定义 CSS（除非必要）
```

### 文件命名

```
features/
├── my-feature/
│   ├── index.ts                    # Manifest (kebab-case)
│   ├── types.ts                    # Types (kebab-case)
│   ├── config.ts                   # Config (kebab-case)
│   ├── pages/
│   │   ├── MyFeaturePage.tsx       # PascalCase
│   │   └── DetailPage.tsx          # PascalCase
│   ├── components/
│   │   ├── FeatureCard.tsx         # PascalCase
│   │   └── FeatureList.tsx         # PascalCase
│   ├── api/
│   │   └── my-feature.api.ts       # kebab-case
│   └── hooks/
│       └── useMyFeature.ts         # camelCase with 'use' prefix
```

---

## 质量标准

### 必须通过

1. **TypeScript 编译**: 无类型错误
2. **ESLint**: 无 errors（warnings 可接受）
3. **构建**: `npm run build` 成功
4. **格式化**: 代码通过 Prettier 格式化

### 建议达到

1. **测试覆盖**: 80%+ 代码覆盖率
2. **文档**: Feature 有 README.md
3. **性能**: 组件加载 < 500ms

---

## Feature Checklist

新 Feature 提交前检查：

### 基础要求

- [ ] 创建 `features/my-feature/index.ts` (FeatureManifest)
- [ ] 在 `features/index.ts` 中注册
- [ ] 至少一个页面组件
- [ ] 路由配置正确
- [ ] TypeScript 类型无误

### 代码质量

- [ ] 通过 `npm run type-check`
- [ ] 通过 `npm run lint` (0 errors)
- [ ] 通过 `npm run build`
- [ ] 代码已格式化 (`npm run format`)

### 文档

- [ ] Feature 有 README.md
- [ ] 关键函数有注释
- [ ] 复杂逻辑有说明

### 测试

- [ ] 手动测试通过
- [ ] 单元测试（如适用）
- [ ] 边界情况处理

### UI/UX

- [ ] 响应式设计
- [ ] 错误状态处理
- [ ] 加载状态提示
- [ ] 图标选择合适

---

## 开发环境

### 必备工具

- Node.js 20+
- npm 9+
- Git
- VS Code (推荐)

### VS Code 插件

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense

### 环境配置

```bash
# 安装依赖
cd dashboard
npm install

# 启动开发服务器
npm run dev

# 另一个终端，启动后端
cd ../backend
npm run dev
```

---

## 调试指南

### 查看 Feature 加载

```typescript
// 浏览器控制台
localStorage.debug = 'features:*';
location.reload();
```

### React DevTools

安装 React DevTools 浏览器扩展，查看组件树和状态。

### Network 面板

检查 API 请求和响应：

1. 打开开发者工具
2. 切换到 Network 面板
3. 筛选 XHR/Fetch 请求

### TypeScript 错误

```bash
# 详细类型检查
npx tsc --noEmit --pretty

# 仅检查某个文件
npx tsc --noEmit features/my-feature/pages/MyPage.tsx
```

---

## 常见陷阱

### 1. 模块解析错误

❌ **错误**:
```typescript
import { something } from 'package-name';  // Cannot find module
```

✅ **原因**: Features 目录没有 node_modules，依赖来自 dashboard/

✅ **解决**: 确保 dashboard/package.json 包含该依赖

### 2. 路由不匹配

❌ **错误**: 访问 `/my-feature` 显示 404

✅ **检查**:
1. Manifest 中 routes 配置正确？
2. Feature 已注册到 `features/index.ts`？
3. 实例类型匹配？

### 3. 组件不渲染

❌ **错误**: 页面空白，无错误

✅ **检查**:
1. 组件是否 `export default`？
2. 组件加载器路径正确？
3. 浏览器控制台有错误？

### 4. 类型错误

❌ **错误**: TypeScript 报类型不兼容

✅ **解决**:
1. 检查 `features/types.ts` 类型定义
2. 确保使用正确的类型
3. 必要时添加类型断言（谨慎使用）

---

## 发布流程

### 版本更新

```bash
# 更新 manifest 版本
# features/my-feature/index.ts
version: '1.1.0',  # 从 1.0.0 升级

# 更新 CHANGELOG (如果有)
```

### 合并到主分支

```bash
# 确保所有测试通过
npm run type-check
npm run lint
npm run test
npm run build

# 合并
git checkout main
git merge feature/my-feature-name
git push origin main
```

### 部署

CI/CD 会自动构建和部署。

---

## 获取帮助

### 文档

- [Features README](./README.md)
- [Features 审计报告](../FEATURES_AUDIT.md)
- [质量系统文档](../QUALITY_SYSTEM.md)

### 参考实现

查看现有 features:
- **简单**: `features/portfolio/`
- **中等**: `features/cecelia/`
- **复杂**: `features/canvas/`

### 提问

- 创建 GitHub Issue
- 团队内部讨论

---

**最后更新**: 2026-01-26
**维护者**: Claude Sonnet 4.5
