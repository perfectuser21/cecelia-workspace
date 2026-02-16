import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Core features — point to workspace's own features directory
const coreFeaturesPath = path.resolve(__dirname, '../core/features');

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: [
      { find: '@features/core', replacement: coreFeaturesPath },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});
