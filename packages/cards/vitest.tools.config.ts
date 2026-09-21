import { defineConfig } from "vitest/config";

// `tools/` holds reports, not tests — kept out of `pnpm test` (which globs `src/**/*.test.ts`) so a
// report can never fail the suite, and so `coverage.test.ts` stays the only thing asserting what
// *should* be unresolved. Run with `pnpm refs` from the repo root.
export default defineConfig({
  test: { globals: true, include: ["tools/**/*.test.ts"] },
});
