#!/usr/bin/env node
// Release build for iOS IPA (via Capacitor and Xcode / xcodebuild on macOS).
//
// Like scripts/build-android.mjs, this coordinates the full build flow:
// 1. Validates macOS and Xcode / xcodebuild availability.
// 2. Resolves iOS signing configuration (Team ID, export method, provisioning profile).
// 3. Runs mobile:sync (client build + cap sync) to bundle the latest web assets.
// 4. Invokes Capacitor build ios with configured export options (or simulator build with --simulator).
// 5. Automatically handles -allowProvisioningUpdates for automatic profile generation.
// 6. Stages the resulting .ipa into both dist/ios/ and the unified release/ directory.
// 7. Generates/updates the SHA256SUMS.txt checksum manifest.

import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultReleaseDir, getProjectVersion, writeChecksumManifest } from "./lib/release-collector.mjs";
import { loadDotenv } from "./lib/env.mjs";
import { pnpm, run } from "./lib/run.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
loadDotenv(repoRoot);
const clientDir = path.join(repoRoot, "packages", "client");
const iosDir = path.join(clientDir, "ios");
const iosAppDir = path.join(iosDir, "App");

function printHelp() {
  console.log(`
Usage: node scripts/build-ios.mjs [options]
       pnpm ios:build [options]

Builds a release iOS IPA using Capacitor and Xcode (macOS only).

Options:
  --scheme <name>                iOS Scheme to build (default: App)
  --configuration <name>         Build configuration (default: Release)
  --team-id <teamId>             Apple Developer Team ID (or set IOS_TEAM_ID in .env)
  --xcode-team-id <teamId>       Alias for --team-id
  --export-method <method>       Xcode export method (default: app-store-connect)
                                 Choices: app-store-connect, release-testing, enterprise, debugging, developer-id
  --xcode-export-method <method> Alias for --export-method
  --signing-style <style>        Signing style: automatic (default) or manual
  --xcode-signing-style <style>  Alias for --signing-style
  --signing-certificate <cert>   Signing certificate name or SHA-1 hash (for manual signing)
  --provisioning-profile <uuid>  Provisioning profile name or UUID (for manual signing)
  --simulator                    Build an unsigned .app for iOS Simulator without signing credentials
  --skip-sync                    Skip running mobile:sync (client build + cap sync)
  -h, --help                     Show this help message
`);
}

function parseArgs(args) {
  const options = {
    scheme: process.env.IOS_SCHEME || "App",
    configuration: process.env.IOS_CONFIGURATION || "Release",
    teamId: null,
    exportMethod: process.env.IOS_EXPORT_METHOD || "app-store-connect",
    signingStyle: process.env.IOS_SIGNING_STYLE || "automatic",
    signingCertificate: process.env.IOS_SIGNING_CERTIFICATE || null,
    provisioningProfile: process.env.IOS_PROVISIONING_PROFILE || null,
    simulator: false,
    skipSync: false,
    help: false,
    extraCapArgs: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--scheme" && i + 1 < args.length) {
      options.scheme = args[++i];
    } else if (arg === "--configuration" && i + 1 < args.length) {
      options.configuration = args[++i];
    } else if ((arg === "--team-id" || arg === "--xcode-team-id") && i + 1 < args.length) {
      options.teamId = args[++i];
    } else if ((arg === "--export-method" || arg === "--xcode-export-method") && i + 1 < args.length) {
      options.exportMethod = args[++i];
    } else if ((arg === "--signing-style" || arg === "--xcode-signing-style") && i + 1 < args.length) {
      options.signingStyle = args[++i];
    } else if ((arg === "--signing-certificate" || arg === "--xcode-signing-certificate") && i + 1 < args.length) {
      options.signingCertificate = args[++i];
    } else if ((arg === "--provisioning-profile" || arg === "--xcode-provisioning-profile") && i + 1 < args.length) {
      options.provisioningProfile = args[++i];
    } else if (arg === "--simulator") {
      options.simulator = true;
    } else if (arg === "--skip-sync") {
      options.skipSync = true;
    } else {
      options.extraCapArgs.push(arg);
    }
  }

  return options;
}

function ensureDarwinAndXcode() {
  if (process.platform !== "darwin") {
    console.error("\n[build-ios] ERROR: iOS builds require macOS with Xcode installed.");
    console.error(`Currently running on: ${process.platform}\n`);
    process.exit(1);
  }

  try {
    const out = execSync("xcodebuild -version", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    if (out) {
      const firstLine = out.split("\n")[0];
      console.log(`[build-ios] Detected ${firstLine}`);
      return;
    }
  } catch {
    // Falls through to error
  }

  console.error("\n[build-ios] ERROR: 'xcodebuild' was not found or is not properly configured.");
  console.error("Please install Xcode from the Mac App Store and ensure command line tools are selected:");
  console.error("  xcode-select --install\n");
  process.exit(1);
}

function findAppleTeamId() {
  // 1. Explicit env variables
  const envTeamId = process.env.IOS_TEAM_ID || process.env.APPLE_TEAM_ID || process.env.XCODE_TEAM_ID;
  if (envTeamId && envTeamId.trim()) {
    return envTeamId.trim();
  }

  // 2. Discover from macOS Keychain code signing identities
  try {
    const out = execSync("security find-identity -p codesigning -v", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
    // Search for 10-character alphanumeric Apple Developer team ID in parentheses: e.g. (UH7W7JKVGD)
    const matches = out.match(/\(([A-Z0-9]{10})\)/g);
    if (matches && matches.length > 0) {
      const teamId = matches[0].slice(1, -1);
      return teamId;
    }
  } catch {
    // Ignore keychain lookup failures
  }

  return null;
}

function getIosVersionName() {
  const pbxPath = path.join(iosAppDir, "App.xcodeproj", "project.pbxproj");
  if (fs.existsSync(pbxPath)) {
    const content = fs.readFileSync(pbxPath, "utf8");
    const match = content.match(/MARKETING_VERSION\s*=\s*([^;]+);/);
    if (match) {
      return match[1].trim().replace(/^"(.*)"$/, "$1");
    }
  }
  return getProjectVersion();
}

function buildSimulatorApp(options) {
  console.log(`[build-ios] Building iOS Simulator target (${options.configuration}) without code signing...`);
  const xcodeArgs = [
    "-project",
    "App.xcodeproj",
    "-scheme",
    options.scheme,
    "-destination",
    "generic/platform=iOS Simulator",
    "-configuration",
    options.configuration,
    "CODE_SIGNING_ALLOWED=NO",
    "build",
  ];

  const buildRes = run("xcodebuild", xcodeArgs, { cwd: iosAppDir });
  if (buildRes.status !== 0) {
    console.error("\n[build-ios] ERROR: Simulator build failed.");
    process.exit(buildRes.status ?? 1);
  }

  const derivedDir = path.join(process.env.HOME, "Library", "Developer", "Xcode", "DerivedData");
  // Find App.app in DerivedData
  let appPath = null;
  if (fs.existsSync(derivedDir)) {
    const appDirs = fs.readdirSync(derivedDir).filter((d) => d.startsWith("App-"));
    for (const d of appDirs) {
      const candidate = path.join(
        derivedDir,
        d,
        "Build",
        "Products",
        `${options.configuration}-iphonesimulator`,
        "App.app",
      );
      if (fs.existsSync(candidate)) {
        appPath = candidate;
        break;
      }
    }
  }

  const versionName = getIosVersionName();
  const shareDir = path.join(repoRoot, "dist", "ios");
  fs.mkdirSync(shareDir, { recursive: true });

  if (appPath) {
    const targetDir = path.join(shareDir, `marvel-champions-${versionName}-iphonesimulator.app`);
    if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    fs.cpSync(appPath, targetDir, { recursive: true });
    console.log("\n========================================================");
    console.log("  iOS Simulator Build Successful!");
    console.log(`  Staged to: ${targetDir}`);
    console.log("  To run in simulator: xcrun simctl install booted <path-to-app>");
    console.log("========================================================\n");
  } else {
    console.log("\n[build-ios] Simulator build succeeded.");
  }
}

function buildIpaWithAllowProvisioning(options, teamId) {
  console.log("[build-ios] Retrying with xcodebuild archive -allowProvisioningUpdates...");
  const archivePath = path.join(iosAppDir, `${options.scheme}.xcarchive`);
  const archiveArgs = [
    "-project",
    "App.xcodeproj",
    "-scheme",
    options.scheme,
    "-destination",
    "generic/platform=iOS",
    "-archivePath",
    archivePath,
    "archive",
    "-configuration",
    options.configuration,
    "-allowProvisioningUpdates",
  ];

  if (teamId) {
    archiveArgs.push(`DEVELOPMENT_TEAM=${teamId}`);
  }
  if (options.provisioningProfile) {
    archiveArgs.push(`PROVISIONING_PROFILE_SPECIFIER=${options.provisioningProfile}`);
  }

  const archiveRes = run("xcodebuild", archiveArgs, { cwd: iosAppDir });
  if (archiveRes.status !== 0) {
    return false;
  }

  // Export IPA
  const outputDir = path.join(iosAppDir, "output");
  fs.mkdirSync(outputDir, { recursive: true });

  const exportPlistPath = path.join(iosAppDir, "archive.plist");
  const exportPlistContents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${options.exportMethod}</string>
  <key>signingStyle</key>
  <string>${options.signingStyle}</string>
</dict>
</plist>`;
  fs.writeFileSync(exportPlistPath, exportPlistContents);

  const exportArgs = [
    "-exportArchive",
    "-archivePath",
    archivePath,
    "-exportOptionsPlist",
    exportPlistPath,
    "-exportPath",
    outputDir,
    "-allowProvisioningUpdates",
  ];

  const exportRes = run("xcodebuild", exportArgs, { cwd: iosAppDir });

  // Cleanup temporary archive.plist
  try {
    if (fs.existsSync(exportPlistPath)) fs.unlinkSync(exportPlistPath);
  } catch {
    // Ignore cleanup error
  }

  return exportRes.status === 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  ensureDarwinAndXcode();

  // Resolve Team ID
  const teamId = options.teamId || findAppleTeamId();
  if (teamId) {
    console.log(`[build-ios] Using Apple Developer Team ID: ${teamId}`);
  } else if (!options.simulator) {
    console.warn("[build-ios] WARNING: No Apple Developer Team ID specified or discovered in Keychain.");
    console.warn("  Set IOS_TEAM_ID in your .env file or pass --team-id <TEAM_ID> if signing fails.");
  }

  // Step 1: Mobile sync (client build + cap sync)
  if (!options.skipSync) {
    console.log("[build-ios] Step 1: Syncing mobile assets...");
    const syncResult = pnpm(["mobile:sync"], { cwd: clientDir });
    if (syncResult.status !== 0) {
      console.error("[build-ios] ERROR: mobile:sync failed.");
      process.exit(syncResult.status ?? 1);
    }
  } else {
    console.log("[build-ios] Step 1: Skipping mobile assets sync (--skip-sync)...");
  }

  // Simulator path
  if (options.simulator) {
    buildSimulatorApp(options);
    return;
  }

  // Step 2: Capacitor build ios
  console.log(
    `[build-ios] Step 2: Building release iOS app (scheme: ${options.scheme}, configuration: ${options.configuration}, export: ${options.exportMethod})...`,
  );

  const capArgs = [
    "cap",
    "build",
    "ios",
    "--scheme",
    options.scheme,
    "--configuration",
    options.configuration,
    "--xcode-export-method",
    options.exportMethod,
    "--xcode-signing-style",
    options.signingStyle,
  ];

  if (teamId) {
    capArgs.push("--xcode-team-id", teamId);
  }
  if (options.signingCertificate) {
    capArgs.push("--xcode-signing-certificate", options.signingCertificate);
  }
  if (options.provisioningProfile) {
    capArgs.push("--xcode-provisioning-profile", options.provisioningProfile);
  }
  if (options.extraCapArgs.length > 0) {
    capArgs.push(...options.extraCapArgs);
  }

  let buildResult = pnpm(capArgs, { cwd: clientDir });

  // If Capacitor build failed (often due to missing -allowProvisioningUpdates in capacitor-cli), retry with direct xcodebuild
  if (buildResult.status !== 0 && options.signingStyle === "automatic") {
    const success = buildIpaWithAllowProvisioning(options, teamId);
    if (!success) {
      console.error("\n================================================================================");
      console.error("[build-ios] ERROR: iOS Code Signing / Provisioning failed.");
      console.error("================================================================================");
      console.error("Xcode requires an Apple Developer account configured with a provisioning profile");
      console.error(`matching bundle identifier 'com.quincarter.marvelchampions'.`);
      console.error("\nTo configure signing (one-time setup):");
      console.error("  1. Open the iOS project in Xcode:");
      console.error("       pnpm ios:open");
      console.error("  2. In Xcode > Settings > Accounts (Cmd+,), sign in with your Apple ID.");
      console.error("  3. Select the 'App' target > 'Signing & Capabilities' tab.");
      console.error("  4. Check 'Automatically manage signing' and select your Team from the dropdown.");
      console.error("  5. Re-run: pnpm ios:build");
      console.error("\nAlternatively, for simulator testing without signing credentials:");
      console.error("  pnpm ios:build --simulator\n");
      process.exit(1);
    }
  } else if (buildResult.status !== 0) {
    console.error("\n[build-ios] ERROR: Capacitor iOS build failed.");
    process.exit(buildResult.status ?? 1);
  }

  // Step 3: Find generated IPA
  const outputDir = path.join(iosAppDir, "output");
  let foundIpa = null;

  if (fs.existsSync(outputDir)) {
    const ipaFiles = fs.readdirSync(outputDir).filter((f) => f.endsWith(".ipa"));
    if (ipaFiles.length > 0) {
      foundIpa = path.join(outputDir, ipaFiles[0]);
    }
  }

  if (!foundIpa) {
    console.error(`\n[build-ios] ERROR: Expected .ipa file not found in ${outputDir}`);
    process.exit(1);
  }

  console.log(`[build-ios] Step 3: Found exported IPA: ${path.basename(foundIpa)}`);

  // Step 4: Staging
  const versionName = getIosVersionName();

  // Stage to dist/ios for backwards compatibility
  const shareDir = path.join(repoRoot, "dist", "ios");
  fs.mkdirSync(shareDir, { recursive: true });
  for (const stale of fs.readdirSync(shareDir)) {
    if (stale.endsWith(".ipa")) fs.rmSync(path.join(shareDir, stale));
  }
  const shareIpa = path.join(shareDir, `marvel-champions-${versionName}.ipa`);
  fs.copyFileSync(foundIpa, shareIpa);

  // Stage to unified release/ directory
  fs.mkdirSync(defaultReleaseDir, { recursive: true });
  const releaseIpa = path.join(defaultReleaseDir, `marvel-champions-${versionName}.ipa`);
  fs.copyFileSync(foundIpa, releaseIpa);
  writeChecksumManifest();

  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(releaseIpa)).digest("hex");
  const stats = fs.statSync(releaseIpa);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log("\n========================================================");
  console.log("  iOS Release Build Successful!");
  console.log(`  Staged to release/: ${releaseIpa}`);
  console.log(`  (Also at: ${shareIpa})`);
  console.log(`  ${stats.size} bytes (${sizeMb} MB) · sha256 ${sha256.slice(0, 16)}…`);
  console.log("========================================================");
  console.log("\nTo install on a connected iOS device or distribute:");
  console.log(`  xcrun devicectl device install app --device <device-id> "${shareIpa}"`);
  console.log("Or upload to TestFlight / App Store Connect using Transporter or altool.\n");
}

main().catch((err) => {
  console.error("[build-ios] Unhandled error:", err);
  process.exit(1);
});
