import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(root, 'apps/shared'),
      '@content': resolve(root, 'content'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
