#!/usr/bin/env node
// The iOS app as an unsigned .ipa, on a Mac with Xcode (issue #874). There is no Apple Developer account behind the
// game, so nothing here signs it: SideStore, AltStore or Sideloadly re-signs it with the player's own Apple ID when
// they install it (docs/project/ios-install.md). An unsigned .ipa is Payload/App.app zipped, which is all those tools
// need.
//
// Card language: MC_CARD_LANG, as for the other installers. Output: release/MarvelChampions-<v>-<LANG>-iOS-unsigned.ipa.
//
// `--simulator` builds for the iOS Simulator instead: release/MarvelChampions-<v>-<LANG>-iOS-Simulator.zip, App.app
// zipped, which `xcrun simctl install booted App.app` installs. Pull request previews carry it so the game can be
// checked on a Mac without an iPhone. `--skip-web` reuses the web build and `cap sync` already done (CI builds the
// .ipa first, then this).

import fs from "node:fs";
import path from "node:path";
import {
  clientDir,
  defaultReleaseDir,
  getProjectVersion,
  iosIpaName,
  iosSimulatorZipName,
} from "./lib/release-collector.mjs";
import { loadDotenv } from "./lib/env.mjs";
import { pnpm, run } from "./lib/run.mjs";

const repoRoot = path.resolve(clientDir, "..", "..");
loadDotenv(repoRoot);

if (process.platform !== "darwin") {
  console.error("[build-ios] The iOS app builds only on macOS, with Xcode installed.");
  process.exit(1);
}

const simulator = process.argv.includes("--simulator");
const skipWeb = process.argv.includes("--skip-web");
const iosDir = path.join(clientDir, "ios", "App");
const derivedData = path.join(iosDir, simulator ? "build-simulator" : "build");
const version = getProjectVersion();

function step(label, result) {
  if (result.status !== 0) {
    console.error(`[build-ios] ERROR: ${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

// Step 1: the web build, copied into the iOS project with the Capacitor config (`cap sync ios`, not `mobile:sync`,
// which would copy the whole build into the Android project too).
if (skipWeb) {
  console.log("[build-ios] Step 1: Skipped (--skip-web): using the client build already in the iOS project.");
} else {
  console.log("[build-ios] Step 1: Building the client and syncing it into the iOS project...");
  step("The client build", pnpm(["build"], { cwd: clientDir }));
  step("cap sync ios", pnpm(["exec", "cap", "sync", "ios"], { cwd: clientDir }));
}

if (simulator) {
  // A Release build for the Simulator (both Mac architectures). The Simulator runs apps without signing them.
  console.log(`[build-ios] Step 2: Building App.app ${version} for the iOS Simulator...`);
  fs.rmSync(derivedData, { recursive: true, force: true });
  step(
    "xcodebuild (Simulator)",
    run(
      "xcodebuild",
      [
        "-project",
        "App.xcodeproj",
        "-scheme",
        "App",
        "-configuration",
        "Release",
        "-sdk",
        "iphonesimulator",
        "-destination",
        "generic/platform=iOS Simulator",
        "-derivedDataPath",
        derivedData,
        `MARKETING_VERSION=${version}`,
        `CURRENT_PROJECT_VERSION=${version}`,
        "ONLY_ACTIVE_ARCH=NO",
        "CODE_SIGNING_ALLOWED=NO",
        "build",
      ],
      { cwd: iosDir },
    ),
  );
  const simApp = path.join(derivedData, "Build", "Products", "Release-iphonesimulator", "App.app");
  if (!fs.existsSync(simApp)) {
    console.error(`[build-ios] ERROR: Expected the built app at ${simApp}`);
    process.exit(1);
  }
  console.log("[build-ios] Step 3: Zipping App.app...");
  fs.mkdirSync(defaultReleaseDir, { recursive: true });
  const zip = path.join(defaultReleaseDir, iosSimulatorZipName(version));
  fs.rmSync(zip, { force: true });
  step("Zipping App.app", run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", simApp, zip]));
  console.log(`\n[build-ios] Simulator build done: ${zip}`);
  console.log("[build-ios] Unzip it, boot a simulator, then: xcrun simctl install booted App.app\n");
  process.exit(0);
}

// Step 2: a Release build for devices, with code signing off. The version comes from the release (the Xcode project's
// own 1.0 is never shipped), so Settings > General > About on the phone names the same version as the release page.
console.log(`[build-ios] Step 2: Building App.app ${version} for iOS devices, unsigned...`);
fs.rmSync(derivedData, { recursive: true, force: true });
step(
  "xcodebuild",
  run(
    "xcodebuild",
    [
      "-project",
      "App.xcodeproj",
      "-scheme",
      "App",
      "-configuration",
      "Release",
      "-sdk",
      "iphoneos",
      "-destination",
      "generic/platform=iOS",
      "-derivedDataPath",
      derivedData,
      `MARKETING_VERSION=${version}`,
      `CURRENT_PROJECT_VERSION=${version}`,
      "CODE_SIGNING_ALLOWED=NO",
      "CODE_SIGNING_REQUIRED=NO",
      "CODE_SIGN_IDENTITY=",
      "build",
    ],
    { cwd: iosDir },
  ),
);

const app = path.join(derivedData, "Build", "Products", "Release-iphoneos", "App.app");
if (!fs.existsSync(app)) {
  console.error(`[build-ios] ERROR: Expected the built app at ${app}`);
  process.exit(1);
}

// Step 3: Payload/App.app, zipped. `ditto` keeps the bundle exactly as Xcode wrote it (symlinks, permissions).
console.log("[build-ios] Step 3: Packaging the .ipa...");
const staging = path.join(derivedData, "ipa");
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(path.join(staging, "Payload"), { recursive: true });
step("Copying App.app", run("ditto", [app, path.join(staging, "Payload", "App.app")]));

fs.mkdirSync(defaultReleaseDir, { recursive: true });
const ipa = path.join(defaultReleaseDir, iosIpaName(version));
fs.rmSync(ipa, { force: true });
step(
  "Zipping the .ipa",
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", "Payload", ipa], { cwd: staging }),
);

const sizeMb = (fs.statSync(ipa).size / (1024 * 1024)).toFixed(2);
console.log("\n========================================================");
console.log("  iOS build (unsigned) done");
console.log(`  ${ipa}`);
console.log(`  ${sizeMb} MB`);
console.log("  Install it with SideStore, AltStore or Sideloadly: docs/project/ios-install.md");
console.log("========================================================\n");
