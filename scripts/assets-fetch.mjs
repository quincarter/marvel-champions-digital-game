#!/usr/bin/env node
/**
 * Downloads the media bundles `assets/manifest.json` names and puts their files where the game expects them
 * (assets/card-art/bundles/cards, assets/card-art-locales/<lang>, music/<folder>, art/<folder>). Issue #495;
 * scripts/lib/assets.mjs has the layout, the cache and the rules for files you changed locally.
 *
 * Usage: pnpm assets:fetch [bundle or group ...] [--force] [--check] [--prune]
 *   pnpm assets:fetch                 every media bundle (the default; MC_ASSETS sets it when no names are given)
 *   pnpm assets:fetch music card-art  just those groups
 *   pnpm assets:fetch artifacts       the QA and design screenshot archive (never fetched by default)
 *   MC_ASSETS=none                    skip everything (engine-only work, typecheck builds)
 *   --force                           replace files you changed locally instead of keeping them
 *   --check                           download and install nothing; exit 1 if a selected bundle isn't current
 *   --prune                           then delete cached bundles this manifest doesn't name (CI; on a dev machine,
 *                                     a worktree on another commit would download its bundles again)
 *
 * Environment: MC_ASSETS_CACHE (the shared cache folder), MC_ASSETS_LINK=copy (copy instead of hard-linking).
 * A bundle already installed at the manifest's checksum is skipped without reading a byte. Files waiting in incoming/
 * (a pull request's new media, scripts/assets-incoming.mjs) are then copied over the bundles they join.
 */
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  INCOMING_DIR,
  cacheDir,
  bundleOwns,
  installBundle,
  isCurrent,
  listFiles,
  mapIncoming,
  placeIncoming,
  readManifest,
  readState,
  readUnpacked,
  releaseUrl,
  selectBundles,
  sha256File,
  unique,
  unpackInto,
  writeState,
} from "./lib/assets.mjs";

/** Passes bytes through, hashing them on the way to disk. */
class TransformHash extends Transform {
  constructor(hash) {
    super();
    this.hash = hash;
  }
  _transform(chunk, _encoding, callback) {
    this.hash.update(chunk);
    callback(null, chunk);
  }
}

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const force = args.includes("--force");
const check = args.includes("--check");
const prune = args.includes("--prune");
const names = args.filter((a) => !a.startsWith("--"));
const selector = names.length > 0 ? names.join(",") : process.env.MC_ASSETS;
const copy = process.env.MC_ASSETS_LINK === "copy";

const manifest = await readManifest(root);
const bundles = selectBundles(manifest, selector);
if (bundles.length === 0) {
  console.log("[assets] nothing to fetch (MC_ASSETS=none)");
  process.exit(0);
}
const unpacked = bundles.filter((b) => !b.sha256);
if (unpacked.length > 0) {
  console.error(`[assets] not packed yet (no sha256 in the manifest): ${unpacked.map((b) => b.name).join(", ")}`);
  process.exit(1);
}

const cache = cacheDir();
const state = await readState(root);
state.bundles ??= {};
let stale = 0;
let keptTotal = 0;

// incoming/ (scripts/assets-incoming.mjs): a pull request's new media, laid over the bundles at the end. A file laid
// there by an earlier fetch whose incoming copy is gone now (another branch checked out, or packed and merged) is
// taken away again, if untouched since, and its bundle is installed again so the bundle's own file comes back.
const incoming = mapIncoming(manifest, await listFiles(path.join(root, INCOMING_DIR)));
const overlay = incoming.files.filter(({ bundle }) => bundles.includes(bundle));
const overlaid = new Set(overlay.map((f) => f.rel));
state.incoming ??= {};
if (!check) {
  for (const [rel, placed] of Object.entries(state.incoming)) {
    if (overlaid.has(rel)) continue;
    try {
      const current = await fs.stat(path.join(root, ...rel.split("/")));
      if (current.size === placed.size && current.mtimeMs === placed.mtimeMs)
        await fs.rm(path.join(root, ...rel.split("/")));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    delete state.incoming[rel];
    for (const b of manifest.bundles)
      if (rel.startsWith(`${b.dir}/`) && state.bundles[b.name]) state.bundles[b.name].complete = false;
  }
}

for (const bundle of bundles) {
  if (await isCurrent(root, bundle, state)) {
    console.log(`[assets] ${bundle.name}: up to date`);
    continue;
  }
  if (check) {
    console.log(`[assets] ${bundle.name}: not current`);
    stale++;
    continue;
  }
  const { dir, files } = await unpackedBundle(bundle);
  const previous = state.bundles[bundle.name];
  const { record, counts } = await installBundle({
    sourceDir: dir,
    // A path incoming/ overrides is left to the overlay below, not reported as a local edit.
    files: files.filter((rel) => !overlaid.has(`${bundle.dir}/${rel}`)),
    targetDir: path.join(root, bundle.dir),
    // What any bundle in this folder installed: a file whose pack prefix moved here was recorded by its old bundle.
    previousFiles: Object.assign(
      {},
      ...manifest.bundles
        .filter((b) => b !== bundle && b.dir === bundle.dir)
        .map((b) => state.bundles[b.name]?.files ?? {}),
      previous?.files ?? {},
    ),
    copy,
    force,
    ownedElsewhere: (rel) => manifest.bundles.some((b) => b !== bundle && b.dir === bundle.dir && bundleOwns(b, rel)),
  });
  state.bundles[bundle.name] = { sha256: bundle.sha256, complete: counts.kept.length === 0, files: record };
  await writeState(root, state);
  const parts = [`${counts.installed} placed`, `${counts.same} already there`];
  if (counts.removed) parts.push(`${counts.removed} removed`);
  console.log(`[assets] ${bundle.name}: ${parts.join(", ")} → ${bundle.dir}`);
  if (counts.kept.length > 0) {
    keptTotal += counts.kept.length;
    console.warn(
      `[assets] ${bundle.name}: kept ${counts.kept.length} local file(s) that differ from the bundle ` +
        `(pnpm assets:pack ${bundle.name} to publish them, or --force to replace them):\n` +
        counts.kept
          .slice(0, 20)
          .map((rel) => `  ${bundle.dir}/${rel}`)
          .join("\n") +
        (counts.kept.length > 20 ? `\n  … and ${counts.kept.length - 20} more` : ""),
    );
  }
}

if (check && stale > 0) {
  console.error(`[assets] ${stale} bundle(s) not current: run pnpm assets:fetch`);
  process.exit(1);
}
if (keptTotal > 0) console.warn(`[assets] done, keeping ${keptTotal} locally changed file(s)`);
// The overlay: the game, its tests and the preview build show a pull request's media before it is packed.
if (!check && overlay.length > 0) {
  await placeIncoming(root, overlay);
  for (const { rel } of overlay) {
    const { size, mtimeMs } = await fs.stat(path.join(root, ...rel.split("/")));
    state.incoming[rel] = { size, mtimeMs };
  }
  console.log(`[assets] placed ${overlay.length} file(s) from incoming/ over the bundles`);
}
if (!check) await writeState(root, state);
if (incoming.errors.length > 0) console.warn(incoming.errors.map((e) => `[assets] ${e}`).join("\n"));
if (prune) await pruneCache();

/** The bundle's files in the shared cache, downloading and unpacking it first if it isn't there yet. */
async function unpackedBundle(bundle) {
  const dir = path.join(cache, "unpacked", bundle.sha256);
  const files = (await readUnpacked(dir)) ?? (await unpackInto(await cachedZip(bundle), dir));
  return { dir, files };
}

async function cachedZip(bundle) {
  const zip = path.join(cache, "zips", `${bundle.sha256}.zip`);
  try {
    if ((await fs.stat(zip)).size === bundle.size && (await sha256File(zip)) === bundle.sha256) return zip;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.mkdir(path.dirname(zip), { recursive: true });
  const url = releaseUrl(manifest.repo, bundle);
  const part = `${zip}.part-${unique()}`;
  for (let attempt = 1; ; attempt++) {
    try {
      console.log(`[assets] ${bundle.name}: downloading ${(bundle.size / 2 ** 20).toFixed(1)} MB`);
      // A ceiling for a stalled download; the largest bundle takes a few minutes on a slow line.
      const response = await fetch(url, { signal: AbortSignal.timeout(30 * 60 * 1000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
      const hash = createHash("sha256");
      const hashing = new TransformHash(hash);
      await pipeline(Readable.fromWeb(response.body), hashing, createWriteStream(part));
      const sha = hash.digest("hex");
      if (sha !== bundle.sha256) throw new Error(`${bundle.file}: sha256 ${sha}, the manifest says ${bundle.sha256}`);
      await fs.rename(part, zip);
      return zip;
    } catch (error) {
      await fs.rm(part, { force: true });
      if (attempt >= 4) throw error;
      const wait = 2 ** attempt * 1000;
      console.warn(`[assets] ${bundle.name}: ${error.message}; retrying in ${wait / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

/** Deletes the cached zips and unpacked folders of bundles the manifest no longer names. */
async function pruneCache() {
  const wanted = new Set(manifest.bundles.filter((b) => b.sha256).map((b) => b.sha256));
  let removed = 0;
  for (const sub of ["zips", "unpacked"]) {
    let names;
    try {
      names = await fs.readdir(path.join(cache, sub));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    for (const name of names) {
      // Leftovers of an interrupted run (.part-, .tmp-, .stale-) go too.
      if (wanted.has(name.slice(0, 64)) && !/\.(part|tmp|stale)-/.test(name)) continue;
      await fs.rm(path.join(cache, sub, name), { recursive: true, force: true });
      removed++;
    }
  }
  if (removed > 0) console.log(`[assets] pruned ${removed} cached item(s) the manifest no longer names`);
}
