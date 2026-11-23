import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The sample pack (content-packs/sample-hero) imports the SDK by its package name, like a creator's pack does.
    alias: { "@mc/mod-sdk": fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    // A scratch folder for the run's community pack builds, so each pack is built once (src/fixtures/community-pack.ts).
    globalSetup: ["./src/fixtures/community-pack-builds.setup.ts"],
    // Real-game tests take a few seconds each; the 5 s default times out when several suites run at once.
    testTimeout: 30_000,
  },
});
