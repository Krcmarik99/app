import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relatívne cesty, aby build fungoval aj v podpriečinku (napr. GitHub Pages).
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
    // Niektoré testy vykresľujú všetky lekcie a otázky – na vyťaženom počítači to trvá viac ako 5 s.
    testTimeout: 30_000,
  },
});
