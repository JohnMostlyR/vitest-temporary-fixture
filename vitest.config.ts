import { defineConfig } from 'vitest/config';

/**
 * @see https://vite.dev/config/
 */
export default defineConfig({
  test: {
    benchmark: {},
    coverage: {
      exclude: ['src/**/index.{ts,tsx,js,jsx}'],
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './reports/coverage',
    },
    dir: 'tests',
    environment: 'node',
    globals: true,
    include: ['*.test.[jt]s'],
    name: 'Unit',
    root: '.',
    testTimeout: 10000,
  },
});
