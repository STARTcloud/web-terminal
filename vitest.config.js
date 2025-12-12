import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['web/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'web/', 'packaging/', 'docs/', '*.config.*', 'tests/'],
    },
    testTimeout: 10000,
    setupFiles: ['tests/setup.js'],
  },
});
