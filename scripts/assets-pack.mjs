#!/usr/bin/env node
/**
 * Zips a media bundle from the files on disk, uploads it to its own release in the content repo and points
 * `assets/manifest.json` at it. Issue #495; scripts/lib/assets.mjs has the layout.
 *
 * Usage: pnpm assets:pack <bundle ...> | --all [--dry-run]
 *   pnpm assets:pack card-art-wave9   after adding or fixing scans of a wave 9 pack
 *   pnpm assets:pack music-scenarios  after adding a scenario's battle track
 *   pnpm assets:pack --all --dry-run  zip and hash every bundle, upload nothing, change nothing
 *
 * A bundle whose zip comes out byte for byte the same as the manifest's is left alone. A changed one gets a new
 * release tagged `<bundle>-<first 12 hex of its sha256>`; the old release stays, so older commits still fetch what
 * they built with. Needs `gh` signed in with write access to the content repo (the manifest's `repo`).
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  MANIFEST_PATH,
  MAX_BUNDLE_BYTES,
  MEDIA_FILE,
  bundleOwns,
  cacheDir,
  listFiles,
  readManifest,
  readState,
  tagFor,
  writeState,
  writeZip,
} from "./lib/assets.mjs";
import { pnpm, run } from "./lib/run.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const names = args.filter((a) => !a.startsWith("--"));

const manifestFile = path.join(root, MANIFEST_PATH);
const raw = JSON.parse(await fs.readFile(manifestFile, "utf8"));
const manifest = await readManifest(root);
if (!all && names.length === 0) {
  console.error("Usage: pnpm assets:pack <bundle ...> | --all [--dry-run]");
  console.error(`Bundles: ${manifest.bundles.map((b) => b.name).join(", ")}`);
  process.exit(1);
}
const unknown = names.filter((n) => !manifest.bundles.some((b) => b.name === n));
if (unknown.length > 0) {
  console.error(`[assets] no bundle named ${unknown.join(", ")} in ${MANIFEST_PATH}`);
  process.exit(1);
}
const chosen = all
  ? manifest.bundles.filter((b) => b.kind === "media")
  : manifest.bundles.filter((b) => names.includes(b.name));

await warnAboutOrphans();

const work = await fs.mkdtemp(path.join(os.tmpdir(), "mc-assets-pack-"));
const state = await readState(root);
state.bundles ??= {};
let changed = 0;
try {
  for (const bundle of chosen) {
    const base = path.join(root, bundle.dir);
    const files = (await listFiles(base)).filter((rel) => bundleOwns(bundle, rel));
    if (files.length === 0) {
      console.error(`[assets] ${bundle.name}: no files under ${bundle.dir}; nothing to pack`);
      process.exitCode = 1;
      continue;
    }
    const zip = path.join(work, `${bundle.name}.zip`);
    const { size, sha256 } = await writeZip(base, files, zip);
    const mb = `${(size / 2 ** 20).toFixed(1)} MB`;
    if (size > MAX_BUNDLE_BYTES) {
      console.error(`[assets] ${bundle.name}: ${mb} passes GitHub's 2 GiB asset limit; split the bundle`);
      process.exitCode = 1;
      continue;
    }
    if (sha256 === bundle.sha256) {
      console.log(`[assets] ${bundle.name}: unchanged (${files.length} files, ${mb})`);
      continue;
    }
    const tag = tagFor(bundle.name, sha256);
    console.log(`[assets] ${bundle.name}: ${files.length} files, ${mb}, sha256 ${sha256.slice(0, 12)} → ${tag}`);
    if (dryRun) continue;

    upload(tag, zip, bundle, files.length);

    const entry = raw.bundles.find((b) => b.name === bundle.name);
    Object.assign(entry, { tag, file: `${bundle.name}.zip`, size, sha256, files: files.length });
    await fs.writeFile(manifestFile, `${JSON.stringify(raw, null, 2)}\n`);
    changed++;

    // Keep the zip in the shared cache, so another worktree unpacks it without downloading, and record this
    // checkout's files as that bundle's install, so the next `assets:fetch` here skips it.
    const cached = path.join(cacheDir(), "zips", `${sha256}.zip`);
    await fs.mkdir(path.dirname(cached), { recursive: true });
    await fs.copyFile(zip, cached);
    const record = {};
    for (const rel of files) {
      const { size: fileSize, mtimeMs } = await fs.stat(path.join(base, ...rel.split("/")));
      record[rel] = { size: fileSize, mtimeMs };
    }
    state.bundles[bundle.name] = { sha256, complete: true, files: record };
    await writeState(root, state);
  }
} finally {
  await fs.rm(work, { recursive: true, force: true });
}

if (changed > 0) {
  pnpm(["exec", "oxfmt", MANIFEST_PATH], { cwd: root });
  console.log(`[assets] updated ${MANIFEST_PATH} for ${changed} bundle(s); commit it`);
}

function gh(ghArgs, capture = true) {
  return run("gh", ghArgs, { cwd: root, capture });
}

function upload(tag, zip, bundle, count) {
  const repo = manifest.repo;
  const view = gh(["release", "view", tag, "--repo", repo, "--json", "assets", "--jq", ".assets[].name"]);
  if (view.status !== 0) {
    const notes = `${bundle.name}: ${count} files from \`${bundle.dir}\`. Fetched by \`pnpm assets:fetch\` in the game repo.`;
    const created = gh(["release", "create", tag, "--repo", repo, "--title", tag, "--notes", notes, "--latest=false"]);
    if (created.status !== 0) throw new Error(`gh release create ${tag} failed: ${created.stderr || created.stdout}`);
  } else if (view.stdout.split(/\r?\n/).includes(path.basename(zip))) {
    console.log(`[assets] ${bundle.name}: ${tag} already has ${path.basename(zip)}`);
    return;
  }
  const uploaded = gh(["release", "upload", tag, zip, "--repo", repo], false);
  if (uploaded.status !== 0) throw new Error(`gh release upload ${tag} failed`);
}

/**
 * Media files in a bundle folder that no bundle claims and git doesn't track (a new pack's scans, say) would never
 * ship. Tracked ones (the card backs) stay in git on purpose.
 */
async function warnAboutOrphans() {
  const byDir = new Map();
  for (const b of manifest.bundles) byDir.set(b.dir, [...(byDir.get(b.dir) ?? []), b]);
  for (const [dir, owners] of byDir) {
    if (owners.some((b) => !b.prefixes || b.kind !== "media")) continue;
    const listed = run("git", ["ls-files", "--", dir], { cwd: root, capture: true }).stdout ?? "";
    const tracked = new Set(listed.split(/\r?\n/));
    const orphans = (await listFiles(path.join(root, dir))).filter(
      (rel) => MEDIA_FILE.test(rel) && !owners.some((b) => bundleOwns(b, rel)) && !tracked.has(`${dir}/${rel}`),
    );
    if (orphans.length > 0) {
      console.warn(
        `[assets] ${orphans.length} media file(s) in ${dir} belong to no bundle (add their prefix to one in ` +
          `${MANIFEST_PATH}): ${orphans.slice(0, 10).join(", ")}${orphans.length > 10 ? ", …" : ""}`,
      );
    }
  }
}
