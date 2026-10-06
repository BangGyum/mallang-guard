import { defineConfig } from 'vitest/config';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/mallang-guard/' : '/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // T0.2에서 첫 테스트를 추가하면 제거합니다.
    passWithNoTests: true,
  },
}));
