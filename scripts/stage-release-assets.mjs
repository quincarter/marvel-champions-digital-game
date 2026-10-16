// Copies this machine's Tauri bundles into <repoRoot>/release/ under their release names (release-collector.mjs) and
// lists them, plus a copy of each under its versionless name (latestAssetName) for the README's download buttons. The
// release workflow runs it after each desktop build and uploads what it staged.
//
//   node scripts/stage-release-assets.mjs

import { collectDesktopBundles, defaultReleaseDir, stageLatestCopies } from "./lib/release-collector.mjs";

const staged = collectDesktopBundles(defaultReleaseDir);
if (staged.length === 0) {
  console.error("[stage-release-assets] No Tauri bundles found.");
  process.exit(1);
}
for (const asset of staged)
  console.log(`[stage-release-assets] ${asset.name} (${(asset.size / 2 ** 20).toFixed(1)} MB)`);
for (const name of stageLatestCopies(defaultReleaseDir)) console.log(`[stage-release-assets] ${name} (latest copy)`);
