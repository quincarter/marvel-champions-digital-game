#!/usr/bin/env node
// Release orchestrator for Marvel Champions: Digital Edition.
//
// 1. Builds host desktop installers (via Tauri) and signed Android APK (via Capacitor).
// 2. Consolidates all outputs into a single <repoRoot>/release/ directory.
// 3. Generates a SHA256SUMS.txt manifest.
// 4. Creates and pushes the git tag (e.g. v0.1.0).
// 5. Creates or updates the GitHub Release (draft pre-release by default) and uploads all assets.

import fs from "node:fs";
import path from "node:path";
import {
  collectAndroidApk,
  collectDesktopBundles,
  defaultReleaseDir,
  getProjectVersion,
  getReleaseArtifacts,
  repoRoot,
  writeChecksumManifest,
} from "./lib/release-collector.mjs";
import { pnpm, run } from "./lib/run.mjs";

function printHelp() {
  console.log(`
Usage: mise ship-it [options]
       node scripts/ship-it.mjs [options]

Options:
  --version <ver>    Override the release version (default: from tauri.conf.json / package.json)
  --tag <tag>        Override the git tag name (default: v<version>)
  --draft            Create release as draft (default: true)
  --publish          Create release as published immediately (sets --draft=false)
  --prerelease       Mark release as prerelease (default: true)
  --no-prerelease    Do not mark release as prerelease
  --skip-build       Skip building, only tag and release existing artifacts in release/
  --skip-release     Skip git tagging and GitHub release (only build and stage to release/)
  --clean            Clean release/ directory before building
  --allow-dirty      Proceed even if git working directory has uncommitted changes
  --dry-run          Simulate tagging and GitHub release without making remote changes
  --help             Show this help message
`);
}

function parseArgs(args) {
  const options = {
    version: null,
    tag: null,
    draft: true,
    prerelease: true,
    skipBuild: false,
    skipRelease: false,
    clean: false,
    allowDirty: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--version" && i + 1 < args.length) {
      options.version = args[++i];
    } else if (arg === "--tag" && i + 1 < args.length) {
      options.tag = args[++i];
    } else if (arg === "--publish") {
      options.draft = false;
    } else if (arg === "--draft") {
      options.draft = true;
    } else if (arg === "--no-prerelease") {
      options.prerelease = false;
    } else if (arg === "--prerelease") {
      options.prerelease = true;
    } else if (arg === "--skip-build") {
      options.skipBuild = true;
    } else if (arg === "--skip-release") {
      options.skipRelease = true;
    } else if (arg === "--clean") {
      options.clean = true;
    } else if (arg === "--allow-dirty") {
      options.allowDirty = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (!arg.startsWith("-") && !options.version) {
      // Allow positional version: `mise ship-it 0.2.0`
      options.version = arg;
    }
  }

  return options;
}

function checkGitClean() {
  const res = run("git", ["status", "--porcelain"], { cwd: repoRoot, capture: true });
  if (res.status !== 0) {
    console.error("[ship-it] ERROR: Could not determine git status.");
    process.exit(1);
  }
  return res.stdout.trim().length === 0;
}

function checkGhAuth() {
  const res = run("gh", ["auth", "status"], { cwd: repoRoot, capture: true });
  return res.status === 0;
}

function tagExistsLocally(tag) {
  const res = run("git", ["tag", "-l", tag], { cwd: repoRoot, capture: true });
  return res.status === 0 && res.stdout.trim() === tag;
}

function releaseExistsOnGithub(tag) {
  const res = run("gh", ["release", "view", tag], { cwd: repoRoot, capture: true });
  return res.status === 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const version = options.version || getProjectVersion();
  const tag = options.tag || `v${version}`;

  console.log("========================================================");
  console.log("  Marvel Champions: Digital Edition — Ship It");
  console.log(`  Target Version: ${version} (tag: ${tag})`);
  console.log(`  Release Directory: ${defaultReleaseDir}`);
  if (options.dryRun) console.log("  MODE: DRY RUN (no git tags or GitHub releases will be created)");
  console.log("========================================================\n");

  // Pre-flight checks
  if (!options.skipRelease && !options.dryRun) {
    if (!options.allowDirty && !checkGitClean()) {
      console.error("[ship-it] ERROR: Git working tree has uncommitted changes.");
      console.error("         Commit or stash your changes before shipping, or use --allow-dirty.");
      process.exit(1);
    }

    if (!checkGhAuth()) {
      console.error("[ship-it] ERROR: GitHub CLI ('gh') is not authenticated or not installed.");
      console.error("         Run 'gh auth login' before running ship-it, or use --skip-release.");
      process.exit(1);
    }
  }

  // Clean if requested
  if (options.clean && fs.existsSync(defaultReleaseDir)) {
    console.log(`[ship-it] Cleaning ${defaultReleaseDir}...`);
    fs.rmSync(defaultReleaseDir, { recursive: true, force: true });
  }
  fs.mkdirSync(defaultReleaseDir, { recursive: true });

  // Build step
  if (!options.skipBuild) {
    console.log("[ship-it] Step 1: Building desktop package for this host OS...");
    const desktopResult = pnpm(["desktop:build"], { cwd: repoRoot });
    if (desktopResult.status !== 0) {
      console.error("\n[ship-it] ERROR: Desktop build failed.");
      process.exit(desktopResult.status ?? 1);
    }

    console.log("\n[ship-it] Step 2: Building signed Android release APK...");
    const androidResult = pnpm(["android:build"], { cwd: repoRoot });
    if (androidResult.status !== 0) {
      console.error("\n[ship-it] ERROR: Android build failed.");
      process.exit(androidResult.status ?? 1);
    }
  } else {
    console.log("[ship-it] Skipping build steps (--skip-build). Using existing files in release/.");
  }

  // Ensure all existing bundles and APKs are staged
  collectDesktopBundles(defaultReleaseDir);
  collectAndroidApk(version, defaultReleaseDir);
  writeChecksumManifest(defaultReleaseDir);

  const artifacts = getReleaseArtifacts(defaultReleaseDir);
  if (artifacts.length === 0) {
    console.error(`\n[ship-it] ERROR: No release artifacts found in ${defaultReleaseDir}`);
    process.exit(1);
  }

  console.log("\n========================================================");
  console.log(`  Staged Release Artifacts in ${defaultReleaseDir}:`);
  for (const a of artifacts) {
    console.log(`  - ${a.name.padEnd(42)} ${a.sizeMb.padStart(7)} MB  sha256 ${a.sha256.slice(0, 16)}…`);
  }
  console.log("========================================================\n");

  if (options.skipRelease) {
    console.log("[ship-it] Skipping git tagging and GitHub release (--skip-release).");
    console.log("[ship-it] Done! Release artifacts are ready in release/.");
    return;
  }

  // Git Tagging
  console.log(`[ship-it] Step 3: Checking Git tag '${tag}'...`);
  if (!tagExistsLocally(tag)) {
    if (options.dryRun) {
      console.log(`[ship-it] [dry-run] Would create git tag: git tag -a ${tag} -m "Release ${tag}"`);
    } else {
      console.log(`[ship-it] Creating annotated git tag '${tag}'...`);
      const tagResult = run("git", ["tag", "-a", tag, "-m", `Release ${tag}`], { cwd: repoRoot });
      if (tagResult.status !== 0) {
        console.error(`[ship-it] ERROR: Failed to create git tag '${tag}'.`);
        process.exit(tagResult.status ?? 1);
      }
    }
  } else {
    console.log(`[ship-it] Git tag '${tag}' already exists locally.`);
  }

  // Push Tag
  if (options.dryRun) {
    console.log(`[ship-it] [dry-run] Would push git tag: git push origin ${tag}`);
  } else {
    console.log(`[ship-it] Pushing git tag '${tag}' to origin...`);
    const pushResult = run("git", ["push", "origin", tag], { cwd: repoRoot });
    if (pushResult.status !== 0) {
      console.warn(
        `[ship-it] WARNING: 'git push origin ${tag}' returned non-zero. The tag may already exist on remote.`,
      );
    }
  }

  // GitHub Release
  console.log(`\n[ship-it] Step 4: Creating/Updating GitHub Release for '${tag}'...`);
  const manifestFile = path.join(defaultReleaseDir, "SHA256SUMS.txt");
  const filesToUpload = artifacts.map((a) => a.path);
  if (fs.existsSync(manifestFile)) {
    filesToUpload.push(manifestFile);
  }

  const releaseExists = !options.dryRun && releaseExistsOnGithub(tag);

  if (releaseExists) {
    console.log(`[ship-it] Existing GitHub release found for '${tag}'. Uploading artifacts...`);
    if (options.dryRun) {
      console.log(`[ship-it] [dry-run] Would run: gh release upload ${tag} [${filesToUpload.length} files] --clobber`);
    } else {
      const uploadResult = run("gh", ["release", "upload", tag, ...filesToUpload, "--clobber"], { cwd: repoRoot });
      if (uploadResult.status !== 0) {
        console.error("[ship-it] ERROR: Failed to upload release assets to GitHub.");
        process.exit(uploadResult.status ?? 1);
      }
    }
  } else {
    console.log(`[ship-it] Creating new GitHub release for '${tag}'...`);
    const ghArgs = [
      "release",
      "create",
      tag,
      ...filesToUpload,
      "--title",
      `Marvel Champions ${tag}`,
      "--generate-notes",
    ];
    if (options.draft) ghArgs.push("--draft");
    if (options.prerelease) ghArgs.push("--prerelease");

    if (options.dryRun) {
      console.log(`[ship-it] [dry-run] Would run: gh ${ghArgs.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
    } else {
      const createResult = run("gh", ghArgs, { cwd: repoRoot });
      if (createResult.status !== 0) {
        console.error("[ship-it] ERROR: Failed to create GitHub release.");
        process.exit(createResult.status ?? 1);
      }
    }
  }

  console.log("\n========================================================");
  console.log("  Ship It Completed Successfully!");
  console.log(`  Tag: ${tag}`);
  console.log(`  Artifacts: ${artifacts.length} file(s) in ${defaultReleaseDir}`);
  console.log(`  GitHub Release: https://github.com/quincarter/marvel-champions-digital-game/releases/tag/${tag}`);
  if (options.draft) {
    console.log("  Status: Draft Release (review and publish on GitHub once CI completes)");
  }
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("[ship-it] Unhandled error:", err);
  process.exit(1);
});
