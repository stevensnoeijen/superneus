import { defineConfig } from 'vitest/config';
// @ts-expect-error -- plain JS config module without type declarations
import { preactAliases } from './vite.config.js';

export default defineConfig({
  // test the same UI runtime that ships (Preact via the React-compatible API)
  resolve: { alias: preactAliases },
  define: { __APP_VERSION__: JSON.stringify('test-version') },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}'],
      reporter: ['text-summary', 'text'],
    },
  },
});
