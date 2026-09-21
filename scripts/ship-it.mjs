#!/usr/bin/env node
// Release orchestrator for Marvel Champions: Digital Edition.
//
// 1. Resolves release version and batches/merges changelog via Changie.
// 2. Updates version strings across package.json, tauri.conf.json, Cargo.toml, build.gradle, and source constants.
// 3. Commits the release metadata and changelog.
// 4. Builds host desktop installers (via Tauri) and signed Android APK (via Capacitor).
// 5. Consolidates all outputs into a single <repoRoot>/release/ directory.
// 6. Generates a SHA256SUMS.txt manifest.
// 7. Creates and pushes the git tag (e.g. v0.1.1).
// 8. Creates or updates the GitHub Release with Changie release notes and uploads all assets.

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
import { run } from "./lib/run.mjs";

function printHelp() {
  console.log(`
Usage: mise ship-it [patch | minor | major | <version>] [options]
       node scripts/ship-it.mjs [patch | minor | major | <version>] [options]

Version Bumping:
  patch              Bump patch version (e.g. 0.1.0 -> 0.1.1)
  minor              Bump minor version (e.g. 0.1.0 -> 0.2.0)
  major              Bump major version (e.g. 0.1.0 -> 1.0.0)
  auto               Automatically determine bump based on changie change fragments
  <semver>           Specify exact version to release (e.g. 0.2.0)

Options:
  --patch            Bump patch version
  --minor            Bump minor version
  --major            Bump major version
  --auto             Automatically determine bump based on changie change fragments
  --version <ver>    Override the release version
  --skip-bump        Do not bump version, use current version from package.json
  --skip-changelog   Skip changie batch and merge
  --tag <tag>        Override the git tag name (default: v<version>)
  --draft            Create release as draft (default: true)
  --publish          Create release as published immediately (sets --draft=false)
  --prerelease       Mark release as prerelease (default: true)
  --no-prerelease    Do not mark release as prerelease
  --skip-build       Skip building, only tag and release existing artifacts in release/
  --skip-android     Skip building Android APK (build desktop only)
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
    bump: null,
    skipBump: false,
    skipChangelog: false,
    tag: null,
    draft: true,
    prerelease: true,
    skipBuild: false,
    skipAndroid: false,
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
    } else if (arg === "--patch") {
      options.bump = "patch";
    } else if (arg === "--minor") {
      options.bump = "minor";
    } else if (arg === "--major") {
      options.bump = "major";
    } else if (arg === "--auto") {
      options.bump = "auto";
    } else if (arg === "--skip-bump") {
      options.skipBump = true;
    } else if (arg === "--skip-changelog") {
      options.skipChangelog = true;
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
    } else if (arg === "--skip-android" || arg === "--no-android") {
      options.skipAndroid = true;
    } else if (arg === "--skip-release") {
      options.skipRelease = true;
    } else if (arg === "--clean") {
      options.clean = true;
    } else if (arg === "--allow-dirty") {
      options.allowDirty = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (!arg.startsWith("-")) {
      if (["patch", "minor", "major", "auto"].includes(arg.toLowerCase())) {
        options.bump = arg.toLowerCase();
      } else if (/^v?\d+\.\d+\.\d+/.test(arg)) {
        options.version = arg.replace(/^v/, "");
      }
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

function resolveNextVersion(bumpType, currentVersion) {
  const type = bumpType || "auto";

  if (type === "auto") {
    const res = run("changie", ["next", "auto"], { cwd: repoRoot, capture: true });
    if (res.status === 0 && res.stdout.trim()) {
      return res.stdout.trim().replace(/^v/, "");
    }
    // Fall back to patch if no unreleased change fragments found
    return resolveNextVersion("patch", currentVersion);
  }

  const res = run("changie", ["next", type], { cwd: repoRoot, capture: true });
  if (res.status === 0 && res.stdout.trim()) {
    return res.stdout.trim().replace(/^v/, "");
  }

  // Fallback semver calculation if changie is unavailable
  const parts = currentVersion.split(".").map((n) => parseInt(n, 10));
  if (type === "major") return `${parts[0] + 1}.0.0`;
  if (type === "minor") return `${parts[0]}.${parts[1] + 1}.0`;
  return `${parts[0]}.${parts[1]}.${(parts[2] || 0) + 1}`;
}

function bumpAndroidVersionCode() {
  const gradlePath = path.join(repoRoot, "packages", "client", "android", "app", "build.gradle");
  if (!fs.existsSync(gradlePath)) return null;

  let content = fs.readFileSync(gradlePath, "utf8");
  const codeMatch = content.match(/versionCode\s+(\d+)/);
  if (!codeMatch) return null;

  const currentCode = parseInt(codeMatch[1], 10);
  const nextCode = currentCode + 1;
  content = content.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`);
  fs.writeFileSync(gradlePath, content, "utf8");
  return nextCode;
}

function processChangelogAndBump(version, { dryRun = false } = {}) {
  const versionTag = `v${version}`;
  console.log(`[ship-it] Batching changes with Changie for ${versionTag}...`);

  if (dryRun) {
    console.log(`[ship-it] [dry-run] Would run: changie batch ${versionTag} --allow-no-changes`);
    console.log(`[ship-it] [dry-run] Would run: changie merge`);
    console.log(`[ship-it] [dry-run] Would increment Android versionCode`);
    return;
  }

  const batchRes = run("changie", ["batch", versionTag, "--allow-no-changes"], { cwd: repoRoot });
  if (batchRes.status !== 0) {
    console.error("[ship-it] ERROR: changie batch failed.");
    process.exit(batchRes.status ?? 1);
  }

  console.log(`[ship-it] Merging CHANGELOG.md and executing version replacements...`);
  const mergeRes = run("changie", ["merge"], { cwd: repoRoot });
  if (mergeRes.status !== 0) {
    console.error("[ship-it] ERROR: changie merge failed.");
    process.exit(mergeRes.status ?? 1);
  }

  const newCode = bumpAndroidVersionCode();
  if (newCode) {
    console.log(`[ship-it] Incremented Android versionCode to ${newCode}`);
  }

  console.log(`[ship-it] Committing version bump and changelog for ${versionTag}...`);
  run("git", ["add", "-A"], { cwd: repoRoot });
  const commitRes = run("git", ["commit", "-m", `chore(release): ${versionTag}`], { cwd: repoRoot });
  if (commitRes.status !== 0) {
    console.warn("[ship-it] Note: git commit returned non-zero (possibly no files changed).");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const currentVersion = getProjectVersion();
  let version = options.version;

  if (!version) {
    if (!options.skipBump) {
      // If the current version's tag already exists, default to bumping patch
      const bumpType = options.bump || (tagExistsLocally(`v${currentVersion}`) ? "patch" : "auto");
      version = resolveNextVersion(bumpType, currentVersion);
    } else {
      version = currentVersion;
    }
  }

  const tag = options.tag || `v${version}`;
  const isNewVersion = version !== currentVersion;

  console.log("========================================================");
  console.log("  Marvel Champions: Digital Edition — Ship It");
  console.log(`  Current Version: ${currentVersion}`);
  console.log(`  Target Version:  ${version} (tag: ${tag})`);
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

  // Version bump & changelog batching (Step 0)
  if ((isNewVersion || !options.skipBump) && !options.skipChangelog) {
    processChangelogAndBump(version, { dryRun: options.dryRun });
  }

  // Clean if requested
  if (options.clean && fs.existsSync(defaultReleaseDir)) {
    console.log(`[ship-it] Cleaning ${defaultReleaseDir}...`);
    fs.rmSync(defaultReleaseDir, { recursive: true, force: true });
  }
  fs.mkdirSync(defaultReleaseDir, { recursive: true });

  // Build step
  if (!options.skipBuild) {
    console.log("\n[ship-it] Step 1: Building desktop package for this host OS...");
    const desktopScript = path.join(repoRoot, "scripts", "build-desktop.mjs");
    const desktopResult = run(process.execPath, [desktopScript], { cwd: repoRoot });
    if (desktopResult.status !== 0) {
      console.error("\n[ship-it] ERROR: Desktop build failed.");
      process.exit(desktopResult.status ?? 1);
    }

    if (!options.skipAndroid) {
      console.log("\n[ship-it] Step 2: Building signed Android release APK...");
      const androidScript = path.join(repoRoot, "scripts", "build-android.mjs");
      const androidResult = run(process.execPath, [androidScript], { cwd: repoRoot });
      if (androidResult.status !== 0) {
        console.error("\n[ship-it] ERROR: Android build failed.");
        process.exit(androidResult.status ?? 1);
      }
    } else {
      console.log("\n[ship-it] Step 2: Skipping Android build (--skip-android).");
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

  const notesFile = path.join(repoRoot, ".changes", `${tag}.md`);
  const hasNotesFile = fs.existsSync(notesFile);

  const releaseExists = !options.dryRun && releaseExistsOnGithub(tag);

  if (releaseExists) {
    console.log(`[ship-it] Existing GitHub release found for '${tag}'. Uploading artifacts...`);
    if (options.dryRun) {
      console.log(`[ship-it] [dry-run] Would run: gh release upload ${tag} [${filesToUpload.length} files] --clobber`);
      if (hasNotesFile) {
        console.log(`[ship-it] [dry-run] Would run: gh release edit ${tag} --notes-file ${notesFile}`);
      }
    } else {
      const uploadResult = run("gh", ["release", "upload", tag, ...filesToUpload, "--clobber"], { cwd: repoRoot });
      if (uploadResult.status !== 0) {
        console.error("[ship-it] ERROR: Failed to upload release assets to GitHub.");
        process.exit(uploadResult.status ?? 1);
      }
      if (hasNotesFile) {
        run("gh", ["release", "edit", tag, "--notes-file", notesFile], { cwd: repoRoot });
      }
    }
  } else {
    console.log(`[ship-it] Creating new GitHub release for '${tag}'...`);
    const ghArgs = ["release", "create", tag, ...filesToUpload, "--title", `Marvel Champions ${tag}`];
    if (hasNotesFile) {
      ghArgs.push("--notes-file", notesFile);
    } else {
      ghArgs.push("--generate-notes");
    }
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
