#!/usr/bin/env node
// `tauri build` for whichever OS this is running on, made repeatable on macOS.
//
// Tauri bundles with the host's own toolchain, so each OS produces its own installers (the same split as
// .github/workflows/desktop-build.yml): macOS gets the .app and .dmg, Windows the .msi and NSIS -setup.exe,
// Linux the .deb/.rpm/.AppImage. Nothing below is macOS-only except the DMG clean-up, which is skipped elsewhere.
//
// Tauri's DMG step (bundle_dmg.sh) mounts a scratch image, then drives Finder over AppleScript to arrange the
// installer window. When that step fails — Finder busy, an automation prompt nobody answered, a run from a task
// runner — the script exits and leaves the scratch image MOUNTED with its `rw.*.dmg` behind, and that leftover
// makes every later run fail the same way ("error running bundle_dmg.sh"). So: clear our own leftovers first,
// and retry the DMG once without the Finder step if it still fails (the only loss is the window's icon layout).

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectDesktopBundles, defaultReleaseDir, writeChecksumManifest } from "./lib/release-collector.mjs";
import { pnpm } from "./lib/run.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(repoRoot, "packages", "client");
const bundleDir = path.join(clientDir, "src-tauri", "target");
const extraArgs = process.argv.slice(2);

function clearStaleDmgState() {
  if (process.platform !== "darwin") return;
  let info = "";
  try {
    info = execFileSync("hdiutil", ["info"], { encoding: "utf8" });
  } catch {
    return;
  }
  // `hdiutil info` lists one block per attached image: its image-path, then its /dev/disk entries.
  for (const block of info.split("================================================")) {
    const image = block.match(/^image-path\s*:\s*(.+)$/m)?.[1]?.trim();
    if (!image || !image.startsWith(bundleDir)) continue; // only images this build made
    const device = block.match(/^(\/dev\/disk\d+)\s/m)?.[1];
    if (!device) continue;
    console.log(`[build-desktop] Detaching a leftover disk image from an earlier run: ${path.basename(image)}`);
    spawnSync("hdiutil", ["detach", device, "-force"], { stdio: "inherit" });
  }
  if (!fs.existsSync(bundleDir)) return;
  for (const entry of fs.readdirSync(bundleDir, { recursive: true })) {
    const name = path.basename(String(entry));
    if (/^rw\..*\.dmg$/.test(name)) fs.rmSync(path.join(bundleDir, String(entry)), { force: true });
  }
}

function tauriBuild(args, env = process.env) {
  return pnpm(["exec", "tauri", "build", ...args], { cwd: clientDir, env }).status ?? 1;
}

clearStaleDmgState();
let status = tauriBuild(extraArgs);

if (status !== 0 && process.platform === "darwin") {
  console.log("\n[build-desktop] The build failed. Retrying the DMG without the Finder window-layout step…");
  clearStaleDmgState();
  // With CI set, Tauri passes --skip-jenkins to bundle_dmg.sh, which skips the AppleScript/Finder part.
  status = tauriBuild(["--bundles", "dmg", ...extraArgs], { ...process.env, CI: "true" });
  if (status === 0) console.log("[build-desktop] DMG built (plain window layout). The .app bundle is unaffected.");
}

if (status === 0) {
  const staged = collectDesktopBundles();
  if (staged.length > 0) {
    writeChecksumManifest();
    console.log("\n========================================================");
    console.log(`  Desktop build staged to: ${defaultReleaseDir}`);
    for (const file of staged) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      console.log(`  - ${file.name} (${sizeMb} MB) · sha256 ${file.sha256.slice(0, 16)}…`);
    }
    console.log("========================================================");
  }
}

process.exit(status);
