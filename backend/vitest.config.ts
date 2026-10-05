import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const backendRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: backendRoot,
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [fileURLToPath(new URL('./src/test/setup.ts', import.meta.url))],
    include: ['src/**/*.test.ts'],
  },
});
