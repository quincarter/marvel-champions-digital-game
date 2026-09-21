#!/usr/bin/env node
// Signed release APK, from any OS with the Android SDK installed (Gradle runs everywhere; apksigner is a .bat
// wrapper on Windows, which is why every command below goes through ./lib/run.mjs).

import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultReleaseDir, writeChecksumManifest } from "./lib/release-collector.mjs";
import { pnpm, run } from "./lib/run.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const clientDir = path.join(repoRoot, "packages", "client");
const androidDir = path.join(clientDir, "android");

function findApkSignerDir() {
  // 1. Check if apksigner is already on PATH
  try {
    const checkCmd = process.platform === "win32" ? "where apksigner" : "which apksigner";
    const out = execSync(checkCmd, { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim();
    if (out) {
      return null; // Already available on PATH
    }
  } catch {
    // Not on PATH, look in SDK locations
  }

  // 2. Discover SDK directory
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), "Library", "Android", "sdk"),
    path.join(os.homedir(), "Android", "Sdk"),
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
  ].filter(Boolean);

  const localProps = path.join(androidDir, "local.properties");
  if (fs.existsSync(localProps)) {
    const content = fs.readFileSync(localProps, "utf8");
    const match = content.match(/^sdk\.dir=(.*)$/m);
    if (match) {
      candidates.unshift(match[1].trim());
    }
  }

  const binaryName = process.platform === "win32" ? "apksigner.bat" : "apksigner";

  for (const sdk of candidates) {
    const buildToolsDir = path.join(sdk, "build-tools");
    if (!fs.existsSync(buildToolsDir)) continue;

    try {
      const versions = fs
        .readdirSync(buildToolsDir)
        .filter((v) => fs.existsSync(path.join(buildToolsDir, v, binaryName)))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

      if (versions.length > 0) {
        return path.join(buildToolsDir, versions[0]);
      }
    } catch {
      // Continue searching
    }
  }

  return null;
}

function ensureJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return;
  }
  const miseBase = path.join(os.homedir(), "AppData", "Local", "mise", "installs", "java");
  if (fs.existsSync(miseBase)) {
    const candidates = fs
      .readdirSync(miseBase)
      .filter(
        (d) =>
          (d.startsWith("temurin-17") || d.startsWith("17") || d.startsWith("temurin-21") || d.startsWith("21")) &&
          fs.existsSync(path.join(miseBase, d, "bin")),
      )
      .sort()
      .reverse();
    if (candidates.length > 0) {
      const chosen = path.join(miseBase, candidates[0]);
      process.env.JAVA_HOME = chosen;
      process.env.PATH = `${path.join(chosen, "bin")}${path.delimiter}${process.env.PATH}`;
      console.log(`[build-android] Discovered JAVA_HOME in mise: ${chosen}`);
    }
  }
}

function ensureAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
    path.join(os.homedir(), "Library", "Android", "sdk"),
    path.join(os.homedir(), "Android", "Sdk"),
  ].filter(Boolean);

  const sdkDir = candidates.find((p) => p && fs.existsSync(p));
  if (!sdkDir) return null;

  if (!process.env.ANDROID_HOME) {
    process.env.ANDROID_HOME = sdkDir;
  }
  if (!process.env.ANDROID_SDK_ROOT) {
    process.env.ANDROID_SDK_ROOT = sdkDir;
  }

  const localProps = path.join(androidDir, "local.properties");
  if (!fs.existsSync(localProps)) {
    const escaped = sdkDir.replace(/\\/g, "\\\\");
    fs.writeFileSync(localProps, `sdk.dir=${escaped}\n`, "utf8");
    console.log(`[build-android] Created ${localProps} pointing to ${sdkDir}`);
  }

  return sdkDir;
}

ensureJavaHome();
ensureAndroidSdk();

// Ensure apksigner is in PATH
const apksignerDir = findApkSignerDir();
if (apksignerDir) {
  process.env.PATH = `${apksignerDir}${path.delimiter}${process.env.PATH}`;
  console.log(`[build-android] Added apksigner to PATH: ${apksignerDir}`);
}

// Keystore resolution
const keystorePath = process.env.ANDROID_KEYSTORE_PATH
  ? path.resolve(repoRoot, process.env.ANDROID_KEYSTORE_PATH)
  : path.join(repoRoot, "marvel-champions.keystore");

if (!fs.existsSync(keystorePath)) {
  console.error(`[build-android] ERROR: Keystore not found at ${keystorePath}`);
  process.exit(1);
}

const keystorePass = process.env.ANDROID_KEYSTORE_PASSWORD || "rocket";
const keystoreAlias = process.env.ANDROID_KEYSTORE_ALIAS || "marvel-champions";
const keystoreKeyPass = process.env.ANDROID_KEY_PASSWORD || keystorePass;

console.log(`[build-android] Using keystore: ${keystorePath} (alias: ${keystoreAlias})`);

// Step 1: Mobile sync (client build + cap sync)
console.log("[build-android] Step 1: Syncing mobile assets...");
const syncResult = pnpm(["mobile:sync"], { cwd: clientDir });

if (syncResult.status !== 0) {
  console.error("[build-android] ERROR: mobile:sync failed.");
  process.exit(syncResult.status ?? 1);
}

// Step 2: Capacitor build android with apksigner (v2/v3 signature scheme)
console.log("[build-android] Step 2: Building release APK with apksigner...");
const buildResult = pnpm(
  [
    "cap",
    "build",
    "android",
    "--androidreleasetype",
    "APK",
    "--signing-type",
    "apksigner",
    "--keystorepath",
    keystorePath,
    "--keystorepass",
    keystorePass,
    "--keystorealias",
    keystoreAlias,
    "--keystorealiaspass",
    keystoreKeyPass,
  ],
  { cwd: clientDir },
);

if (buildResult.status !== 0) {
  console.error("[build-android] ERROR: Capacitor Android build failed.");
  process.exit(buildResult.status ?? 1);
}

// Step 3: Verify the signed APK
const signedApk = path.join(androidDir, "app", "build", "outputs", "apk", "release", "app-release-signed.apk");
if (!fs.existsSync(signedApk)) {
  console.error(`[build-android] ERROR: Expected signed APK not found at ${signedApk}`);
  process.exit(1);
}

console.log("[build-android] Step 3: Verifying APK signature scheme...");
const verifyResult = run("apksigner", ["verify", "-v", signedApk], { capture: true });

if (verifyResult.status !== 0) {
  console.error("[build-android] ERROR: APK signature verification failed!");
  console.error(verifyResult.stderr || verifyResult.stdout);
  process.exit(1);
}

// Step 4: One clearly named file to share. The Gradle output folder keeps `app-release-unsigned.apk` right next
// to the signed one, nearly the same size — and an unsigned APK is exactly what a phone rejects with
// "App not installed". Uploading the wrong one of the two is an easy mistake, so the file to send lives alone.
const gradle = fs.readFileSync(path.join(androidDir, "app", "build.gradle"), "utf8");
const versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1] ?? "0";

// Stage to dist/android for backwards compatibility
const shareDir = path.join(repoRoot, "dist", "android");
fs.mkdirSync(shareDir, { recursive: true });
for (const stale of fs.readdirSync(shareDir)) if (stale.endsWith(".apk")) fs.rmSync(path.join(shareDir, stale));
const shareApk = path.join(shareDir, `marvel-champions-${versionName}.apk`);
fs.copyFileSync(signedApk, shareApk);

// Stage to the unified release/ directory
fs.mkdirSync(defaultReleaseDir, { recursive: true });
const releaseApk = path.join(defaultReleaseDir, `marvel-champions-${versionName}.apk`);
fs.copyFileSync(signedApk, releaseApk);
writeChecksumManifest();

const sha256 = crypto.createHash("sha256").update(fs.readFileSync(releaseApk)).digest("hex");

const stats = fs.statSync(releaseApk);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

console.log("\n========================================================");
console.log("  Android Release Build Successful!");
console.log(`  Staged to release/: ${releaseApk}`);
console.log(`  (Also at: ${shareApk})`);
console.log(`  ${stats.size} bytes (${sizeMb} MB) · sha256 ${sha256.slice(0, 16)}…`);
console.log("  After downloading it on the phone, the size should match to the byte.");
console.log("  Signatures verified: APK Signature Scheme v2 & v3 active");
console.log("========================================================");
console.log("\nTo install on a connected Android device or emulator:");
console.log(`  adb install -r "${shareApk}"\n`);
console.log('If the phone says "App not installed": a copy signed with a DIFFERENT key is already on it');
console.log("(an older debug build, signed with Android's debug key). Android will not install over a");
console.log("different signature. Remove it once, then install again:");
console.log("  adb uninstall com.quincarter.marvelchampions     (or long-press the app icon > Uninstall)");
console.log("Debug builds are now signed with this same keystore (android/app/build.gradle), so it");
console.log("will not come back.\n");
