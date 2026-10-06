import { defineConfig } from 'vitest/config';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/mallang-guard/' : '/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
}));
