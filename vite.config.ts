import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relatívne cesty, aby build fungoval aj v podpriečinku (napr. GitHub Pages).
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
