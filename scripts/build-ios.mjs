#!/usr/bin/env node
// Release IPA for iOS (macOS with Xcode only), the iOS counterpart of scripts/build-android.mjs.
//
// It archives and exports with xcodebuild directly rather than through `cap build ios`: Capacitor's archive
// step never passes -allowProvisioningUpdates, so automatic signing fails whenever the provisioning profile
// isn't already on the machine, and it has no way to hand xcodebuild an App Store Connect API key, which is
// how CI signs without anyone signed in to Xcode.
//
// Signing, in the order it is tried:
//   - automatic (default): the project's DEVELOPMENT_TEAM, or IOS_TEAM_ID. Locally that's the Apple ID signed
//     in to Xcode; headless (CI) it's an App Store Connect API key (IOS_ASC_KEY_PATH, IOS_ASC_KEY_ID,
//     IOS_ASC_ISSUER_ID) with the Admin role, which lets Xcode create cloud-managed certificates and profiles.
//   - manual: a certificate already in the keychain plus a provisioning profile (IOS_SIGNING_CERTIFICATE,
//     IOS_PROVISIONING_PROFILE).
//   - --simulator: no signing at all; an .app for the iOS Simulator, which is also CI's compile check when no
//     signing secrets are configured.
//
// The IPA lands in packages/client/ios/App/output/, then is staged to dist/ios/ and release/ with the
// SHA256SUMS.txt manifest, like the APK.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectIosIpa,
  defaultReleaseDir,
  getProjectVersion,
  writeChecksumManifest,
} from "./lib/release-collector.mjs";
import { loadDotenv } from "./lib/env.mjs";
import { pnpm, run } from "./lib/run.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
loadDotenv(repoRoot);
const clientDir = path.join(repoRoot, "packages", "client");
const iosAppDir = path.join(clientDir, "ios", "App");
const outputDir = path.join(iosAppDir, "output");
const bundleId = "com.quincarter.marvelchampions";

const EXPORT_METHODS = ["app-store-connect", "release-testing", "enterprise", "debugging"];

function printHelp() {
  console.log(`
Usage: node scripts/build-ios.mjs [options]
       pnpm ios:build [options]

Builds a signed release IPA with Xcode (macOS only), or an unsigned Simulator .app.

Options:
  --scheme <name>                Scheme to build (default: App, or IOS_SCHEME)
  --configuration <name>         Build configuration (default: Release, or IOS_CONFIGURATION)
  --team-id <id>                 Apple Developer Team ID (default: the project's, or IOS_TEAM_ID)
  --export-method <method>       ${EXPORT_METHODS.join(" | ")}
                                 (default: app-store-connect, or IOS_EXPORT_METHOD)
  --signing-style <style>        automatic (default) | manual (or IOS_SIGNING_STYLE)
  --signing-certificate <cert>   Certificate name or SHA-1, for manual signing (or IOS_SIGNING_CERTIFICATE)
  --provisioning-profile <name>  Profile name or UUID, for manual signing (or IOS_PROVISIONING_PROFILE)
  --simulator                    Build an unsigned .app for the iOS Simulator instead
  --skip-sync                    Skip mobile:sync (client build + cap sync)
  -h, --help                     Show this help

Headless automatic signing reads an App Store Connect API key from IOS_ASC_KEY_PATH (the .p8 file),
IOS_ASC_KEY_ID and IOS_ASC_ISSUER_ID.
`);
}

function parseArgs(args) {
  const options = {
    scheme: process.env.IOS_SCHEME || "App",
    configuration: process.env.IOS_CONFIGURATION || "Release",
    teamId: process.env.IOS_TEAM_ID || null,
    exportMethod: process.env.IOS_EXPORT_METHOD || "app-store-connect",
    signingStyle: process.env.IOS_SIGNING_STYLE || "automatic",
    signingCertificate: process.env.IOS_SIGNING_CERTIFICATE || null,
    provisioningProfile: process.env.IOS_PROVISIONING_PROFILE || null,
    simulator: false,
    skipSync: false,
    help: false,
  };

  const valueFlags = {
    "--scheme": "scheme",
    "--configuration": "configuration",
    "--team-id": "teamId",
    "--export-method": "exportMethod",
    "--signing-style": "signingStyle",
    "--signing-certificate": "signingCertificate",
    "--provisioning-profile": "provisioningProfile",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--simulator") options.simulator = true;
    else if (arg === "--skip-sync") options.skipSync = true;
    else if (valueFlags[arg] && i + 1 < args.length) options[valueFlags[arg]] = args[++i];
    else {
      console.error(`[build-ios] Unknown option: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!EXPORT_METHODS.includes(options.exportMethod)) {
    console.error(`[build-ios] --export-method must be one of: ${EXPORT_METHODS.join(", ")}`);
    process.exit(1);
  }
  if (options.signingStyle !== "automatic" && options.signingStyle !== "manual") {
    console.error("[build-ios] --signing-style must be automatic or manual");
    process.exit(1);
  }
  if (options.signingStyle === "manual" && (!options.signingCertificate || !options.provisioningProfile)) {
    console.error("[build-ios] Manual signing needs --signing-certificate and --provisioning-profile.");
    process.exit(1);
  }
  return options;
}

function ensureXcode() {
  if (process.platform !== "darwin") {
    console.error(`[build-ios] iOS builds need macOS with Xcode (this is ${process.platform}).`);
    process.exit(1);
  }
  const res = run("xcodebuild", ["-version"], { capture: true });
  if (res.status !== 0) {
    console.error(
      "[build-ios] xcodebuild isn't usable. Install Xcode, then: sudo xcode-select -s /Applications/Xcode.app",
    );
    process.exit(1);
  }
  console.log(`[build-ios] ${res.stdout.split("\n")[0]}`);
}

/** xcodebuild arguments for App Store Connect API key auth, or [] when no key is configured. */
function apiKeyArgs() {
  const { IOS_ASC_KEY_PATH: keyPath, IOS_ASC_KEY_ID: keyId, IOS_ASC_ISSUER_ID: issuerId } = process.env;
  if (!keyPath && !keyId && !issuerId) return [];
  if (!keyPath || !keyId || !issuerId || !fs.existsSync(keyPath)) {
    console.error("[build-ios] IOS_ASC_KEY_PATH (an existing .p8), IOS_ASC_KEY_ID and IOS_ASC_ISSUER_ID go together.");
    process.exit(1);
  }
  return [
    "-authenticationKeyPath",
    path.resolve(keyPath),
    "-authenticationKeyID",
    keyId,
    "-authenticationKeyIssuerID",
    issuerId,
  ];
}

function xcodebuild(args, what) {
  const res = run("xcodebuild", args, { cwd: iosAppDir });
  if (res.status !== 0) {
    console.error(`\n[build-ios] ${what} failed.`);
    return false;
  }
  return true;
}

function buildSimulator(options) {
  const derivedData = path.join(iosAppDir, "build", "simulator");
  const ok = xcodebuild(
    [
      "-project",
      "App.xcodeproj",
      "-scheme",
      options.scheme,
      "-configuration",
      options.configuration,
      "-destination",
      "generic/platform=iOS Simulator",
      "-derivedDataPath",
      derivedData,
      "CODE_SIGNING_ALLOWED=NO",
      "build",
    ],
    "Simulator build",
  );
  if (!ok) process.exit(1);

  const app = path.join(derivedData, "Build", "Products", `${options.configuration}-iphonesimulator`, "App.app");
  const shareDir = path.join(repoRoot, "dist", "ios");
  const staged = path.join(shareDir, `marvel-champions-${getProjectVersion()}-simulator.app`);
  fs.mkdirSync(shareDir, { recursive: true });
  fs.rmSync(staged, { recursive: true, force: true });
  fs.cpSync(app, staged, { recursive: true });
  console.log(`\n[build-ios] Simulator build staged to ${staged}`);
  console.log(`  Install on a booted simulator: xcrun simctl install booted "${staged}"`);
}

function exportOptionsPlist(options) {
  const entries = [
    ["method", options.exportMethod],
    ["signingStyle", options.signingStyle],
    ...(options.teamId ? [["teamID", options.teamId]] : []),
    ...(options.signingStyle === "manual" ? [["signingCertificate", options.signingCertificate]] : []),
  ];
  const profiles =
    options.signingStyle === "manual"
      ? `\n  <key>provisioningProfiles</key>\n  <dict>\n    <key>${bundleId}</key>\n    <string>${options.provisioningProfile}</string>\n  </dict>`
      : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${entries.map(([k, v]) => `  <key>${k}</key>\n  <string>${v}</string>`).join("\n")}${profiles}
</dict>
</plist>
`;
}

function signingHelp() {
  console.error(`
[build-ios] Signing needs one of:
  - Xcode signed in to an Apple ID on the project's team (Xcode > Settings > Accounts), for local builds;
  - an App Store Connect API key with the Admin role: IOS_ASC_KEY_PATH, IOS_ASC_KEY_ID, IOS_ASC_ISSUER_ID;
  - manual signing: --signing-style manual --signing-certificate <cert> --provisioning-profile <profile>.
For an unsigned Simulator build: pnpm ios:build --simulator
`);
}

function buildIpa(options) {
  const archivePath = path.join(iosAppDir, "build", `${options.scheme}.xcarchive`);
  const plistPath = path.join(iosAppDir, "build", "ExportOptions.plist");
  const auth = apiKeyArgs();
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.rmSync(archivePath, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });

  const settings = [];
  if (options.teamId) settings.push(`DEVELOPMENT_TEAM=${options.teamId}`);
  if (options.signingStyle === "manual") {
    settings.push(
      "CODE_SIGN_STYLE=Manual",
      `CODE_SIGN_IDENTITY=${options.signingCertificate}`,
      `PROVISIONING_PROFILE_SPECIFIER=${options.provisioningProfile}`,
    );
  }
  const provisioning = options.signingStyle === "automatic" ? ["-allowProvisioningUpdates", ...auth] : [];

  console.log(
    `[build-ios] Archiving ${options.scheme} (${options.configuration}, ${options.signingStyle} signing${auth.length ? ", API key" : ""})...`,
  );
  const archived = xcodebuild(
    [
      "-project",
      "App.xcodeproj",
      "-scheme",
      options.scheme,
      "-configuration",
      options.configuration,
      "-destination",
      "generic/platform=iOS",
      "-archivePath",
      archivePath,
      ...provisioning,
      ...settings,
      "archive",
    ],
    "Archive",
  );
  if (!archived) {
    signingHelp();
    process.exit(1);
  }

  console.log(`[build-ios] Exporting IPA (${options.exportMethod})...`);
  fs.writeFileSync(plistPath, exportOptionsPlist(options));
  const exported = xcodebuild(
    [
      "-exportArchive",
      "-archivePath",
      archivePath,
      "-exportOptionsPlist",
      plistPath,
      "-exportPath",
      outputDir,
      ...provisioning,
    ],
    "Export",
  );
  fs.rmSync(plistPath, { force: true });
  if (!exported) {
    signingHelp();
    process.exit(1);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  ensureXcode();

  if (options.skipSync) {
    console.log("[build-ios] Skipping mobile:sync (--skip-sync).");
  } else {
    console.log("[build-ios] Building the client and syncing it into the iOS project...");
    const sync = pnpm(["mobile:sync"], { cwd: clientDir });
    if (sync.status !== 0) {
      console.error("[build-ios] mobile:sync failed.");
      process.exit(sync.status ?? 1);
    }
  }

  if (options.simulator) {
    buildSimulator(options);
    return;
  }

  buildIpa(options);

  const version = getProjectVersion();
  const staged = collectIosIpa(version, defaultReleaseDir);
  if (!staged) {
    console.error(`[build-ios] Export succeeded but no .ipa is in ${outputDir}.`);
    process.exit(1);
  }
  writeChecksumManifest();

  const shareDir = path.join(repoRoot, "dist", "ios");
  fs.mkdirSync(shareDir, { recursive: true });
  for (const stale of fs.readdirSync(shareDir)) {
    if (stale.endsWith(".ipa")) fs.rmSync(path.join(shareDir, stale));
  }
  fs.copyFileSync(staged.path, path.join(shareDir, staged.name));

  console.log(`\n[build-ios] ${staged.name} (${(staged.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`  release/: ${staged.path}`);
  console.log(`  sha256 ${staged.sha256}`);
}

main();
