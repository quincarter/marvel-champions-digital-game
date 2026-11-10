import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    // Real-game tests take a few seconds each; the 5 s default times out when several suites run at once.
    testTimeout: 30_000,
  },
});
