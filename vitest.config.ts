import { defineConfig } from "vitest/config";

// The root `pnpm test` runs every package as one Vitest run that shares a single worker pool. `pnpm -r test` ran the
// packages one after another (the dependency chain client → cards → engine → content leaves pnpm nothing to run side
// by side), so the cores sat idle while each package's last few files finished: 511 s against 431 s here on a 10-core
// laptop, 2026-10-09. Each package keeps its own config (include globs, timeouts) and its own `test` script.
export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.ts"],
  },
});
