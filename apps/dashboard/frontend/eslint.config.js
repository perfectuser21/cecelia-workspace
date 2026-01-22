import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React Hooks 规则
      'react-hooks/rules-of-hooks': 'error',
      // 暂时关闭 exhaustive-deps，后续通过专门的 PR 逐步修复
      'react-hooks/exhaustive-deps': 'off',
      // 暂时关闭新版 react-hooks 插件的严格规则
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',

      // 暂时关闭 react-refresh 规则，Context 文件导出 hook 是常见模式
      'react-refresh/only-export-components': 'off',

      // TypeScript 规则
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // 暂时关闭 no-explicit-any，后续通过专门的 PR 处理
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
