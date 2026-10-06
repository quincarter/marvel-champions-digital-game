import { defineConfig, devices } from "@playwright/test";

/**
 * The guided-mode e2e suite (`docs/guided-mode.md` §4 G11): a small, fast, deterministic regression net so the
 * tutorial flow can't silently break. It runs against this package's own **Vite dev server**, never a production
 * build — `scenes/boot.ts`'s `?screen=` dev jumps (used by the Hold on! and tips fixtures) are gated on
 * `import.meta.env.DEV`, so a `vite preview`/built bundle wouldn't have them.
 *
 * A fixed, distinct port (5193) plus `reuseExistingServer: false` in CI: other agents/sessions routinely run their
 * own dev servers on other ports (5183 and friends — see `docs/guided-mode.md` §6), so this must never attach to
 * someone else's server, locally or in CI.
 */
const PORT = Number(process.env.E2E_PORT ?? "5193");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Two workers in CI (measured 2026-10-04 on the 4 vCPU runner, four shards, motion off, two runs each: one worker
  // 6-18 min per shard; two workers 6-15 min and green both times; three workers timed out specs (a 60 s mojo-setup
  // page.evaluate, Shadowcat at 4 minutes) because three software-WebGL Phaser pages starve each other). The specs share
  // no state (a fresh context each, nothing written to disk), so this is a CPU limit, not a dependency. `E2E_WORKERS`
  // overrides it (the workflow's `workers` dispatch input). Locally, eight (the owner's call, 2026-10-05): the suite is
  // the pre-push gate, a laptop renders on its GPU, and Playwright's own default is only half the cores.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : process.env.CI ? 2 : 8,
  // Most specs finish in about a minute on a laptop and take two to three times that on the CI runner (software WebGL),
  // so this is a ceiling for a hung test, not a speed check; the long guided runs set their own with `test.setTimeout`.
  timeout: 120_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // Motion off for the whole suite (the owner's call, 2026-10-04): the client reads `prefers-reduced-motion` for its
    // default Reduce motion setting, so no slide, fade, pulse or walkthrough auto-advance runs, and a test never has
    // to catch a moment. A spec that is about animation or timing opts back in with
    // `test.use({ reducedMotion: "no-preference" })` and asserts through a durable record, not by watching.
    reducedMotion: "reduce",
    // macOS SwiftShader (the default software GL) renders black bands on some masked draws in headless Chromium;
    // Metal is the fix locally (`docs/guided-mode.md` MEMORY "Headless GPU for masks"). Linux CI runners have no
    // Metal, so this only applies on the machine that has it — the default ANGLE backend is fine there.
    launchOptions: {
      // `E2E_SOFTWARE_GL=1` models the CI runner on a laptop: software WebGL (SwiftShader) instead of Metal.
      args: process.env.E2E_SOFTWARE_GL
        ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
        : process.platform === "darwin"
          ? ["--use-angle=metal"]
          : [],
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
      // tutorial.spec.ts and never-locked-in.spec.ts drive the long-table board layout directly (the payment bar,
      // the desktop/tablet-landscape guide rail's own "Skip this step"/"Stop tutorial"); the phone board's tabbed
      // layout routes the same actions through Inspect and a bottom tab rail instead (`docs/guided-mode.md` §4 G11
      // phone QA findings), which is real, separately-shaped UI this suite doesn't drive yet. holdon.spec.ts and
      // tips.spec.ts only click focus-rect actions that exist on the phone board's default tab, so those two run
      // here unchanged.
      testMatch: [
        "holdon.spec.ts",
        "tips.spec.ts",
        "overlay-input-block.spec.ts",
        "overlay-controls.spec.ts",
        "energy-transfer-host.spec.ts",
        "uncanny-controller.spec.ts",
        "any-number-cost.spec.ts",
        "tap-redraw.spec.ts",
        "break-time.spec.ts",
        "angel-form.spec.ts",
        "off-turn-action.spec.ts",
        "which-ability.spec.ts",
      ],
    },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
