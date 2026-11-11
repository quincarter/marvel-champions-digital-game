// The Mod Store catalog, `index.json` (docs/custom-content-packs.md §11.5; `PackIndex` in
// packages/content/src/schema/packs.ts): building one pack's entry from what `mc-pack build` wrote, and upserting the
// packs a publish run built into the catalog already on R2.
//
// Used by scripts/publish-pack-index.mjs (the publish-packs workflow). scripts/build-pack-catalog.mjs (the temporary
// same-origin catalog of the Netlify builds) writes the same per-version shape by hand; once it is kept, it should
// call `packVersionEntry` / `packIndexEntry` here instead (with its `/packs/<id>/<version>/` base).
//
// Rules for an upsert:
//   - packs this run didn't build stay as they are, whoever published them (the registry repo publishes to the same
//     catalog);
//   - a built pack keeps its older versions, so saves that used them still load;
//   - a version already listed with a different zip sha256 is an error: published versions never change;
//   - `approved` keeps the date the pack was first listed;
//   - the pack's name, summary, thumbnail and the rest follow its newest version, and `latest` is the newest version.

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const PACK_INDEX_SCHEMA = 2;

/** One version's entry. `base` ends with `/`; `hasPreview` says whether `preview.json` was published beside the zip. */
export function packVersionEntry({ manifest, base, zipBytes, zipSha256, hasPreview = false, zipFallback }) {
  const zipName = `${manifest.id}-${manifest.version}.zip`;
  return {
    manifest: `${base}pack.json`,
    base,
    zip: `${base}${zipName}`,
    ...(zipFallback ? { zipFallback } : {}),
    zipBytes,
    zipSha256,
    requires: manifest.requires,
    ...(hasPreview ? { preview: `${base}preview.json` } : {}),
  };
}

/** One pack's catalog entry with a single version: the built `pack.json` and the zip's size and sha256. */
export function packIndexEntry({
  manifest,
  base,
  zipBytes,
  zipSha256,
  hasPreview = false,
  hasThumb = false,
  approved,
}) {
  return {
    id: manifest.id,
    kind: manifest.kind,
    name: manifest.name,
    creator: manifest.authors?.[0] ?? "Unknown",
    summary: String(manifest.description ?? "").split("\n")[0],
    tags: [manifest.kind],
    ...(hasThumb ? { thumbnail: `${base}thumb.webp` } : {}),
    approved,
    latest: manifest.version,
    versions: { [manifest.version]: packVersionEntry({ manifest, base, zipBytes, zipSha256, hasPreview }) },
    withdrawn: false,
  };
}

/** The base URL of one published version: `<baseUrl>/<id>/<version>/`. */
export function versionBase(baseUrl, id, version) {
  return `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(id)}/${encodeURIComponent(version)}/`;
}

/**
 * Compares two `major.minor.patch[-pre]` versions: negative when `a` is older. A version with a pre-release part
 * sorts before the same version without one; pre-release parts compare as strings.
 */
export function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre] = String(v).split("-", 2);
    return { nums: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d !== 0) return d;
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === undefined) return 1;
  if (y.pre === undefined) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/**
 * Returns a new catalog: `current` (the index.json on R2, or undefined when there is none yet) with `built` upserted.
 * `built` is a list of `packIndexEntry` results, one version each. `today` is `YYYY-MM-DD`, `now` an ISO time.
 */
export function upsertPackIndex(current, built, { today, now }) {
  if (current !== undefined && current !== null) {
    if (typeof current !== "object" || !Array.isArray(current.packs))
      throw new Error("the current index.json has no packs list");
    if (current.schema !== PACK_INDEX_SCHEMA)
      throw new Error(`the current index.json is schema ${current.schema}; this script writes ${PACK_INDEX_SCHEMA}`);
  }
  const byId = new Map((current?.packs ?? []).map((pack) => [pack.id, pack]));
  const seen = new Set();
  for (const entry of built) {
    if (seen.has(entry.id)) throw new Error(`${entry.id} was built twice in one run`);
    seen.add(entry.id);
    const [version, versionEntry] = Object.entries(entry.versions)[0];
    const previous = byId.get(entry.id);
    const listed = previous?.versions?.[version];
    if (listed && listed.zipSha256 !== versionEntry.zipSha256) {
      throw new Error(
        `${entry.id} ${version} is already published with a different zip (sha256 ${listed.zipSha256}, now ` +
          `${versionEntry.zipSha256}): bump the version in its pack.json`,
      );
    }
    const versions = { ...previous?.versions, [version]: versionEntry };
    const newest = Object.keys(versions).sort(compareVersions).at(-1);
    // The pack's own fields follow its newest version: a re-run of an older version leaves them alone.
    const head = !previous || newest === version ? entry : previous;
    byId.set(entry.id, {
      ...head,
      approved: previous?.approved ?? entry.approved ?? today,
      latest: newest,
      versions,
      withdrawn: false,
    });
  }
  const packs = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "en") || (a.id < b.id ? -1 : 1));
  return { schema: PACK_INDEX_SCHEMA, generated: now, packs };
}

/**
 * The packs staged for upload under `dir`, laid out as on R2: `<id>/<version>/` holding `<id>-<version>.zip` and
 * `pack.json` (from `mc-pack build`), and `preview.json` and `thumb.webp` when the build wrote them. Returns their
 * `packIndexEntry`s with URLs under `baseUrl`, sorted by id. `approved` is the date a pack new to the catalog gets.
 */
export async function readStagedPacks(dir, baseUrl, approved) {
  const has = (file) =>
    fs.stat(file).then(
      (s) => s.isFile(),
      () => false,
    );
  const entries = [];
  for (const id of (await fs.readdir(dir)).sort()) {
    const versions = await fs.readdir(path.join(dir, id));
    if (versions.length !== 1)
      throw new Error(`${id}: expected one staged version, found ${versions.join(", ") || "none"}`);
    const version = versions[0];
    const at = path.join(dir, id, version);
    const manifest = JSON.parse(await fs.readFile(path.join(at, "pack.json"), "utf8"));
    if (manifest.id !== id || manifest.version !== version)
      throw new Error(`${id}/${version}: its pack.json says ${manifest.id} ${manifest.version}`);
    const zip = await fs.readFile(path.join(at, `${id}-${version}.zip`));
    entries.push(
      packIndexEntry({
        manifest,
        base: versionBase(baseUrl, id, version),
        zipBytes: zip.length,
        zipSha256: createHash("sha256").update(zip).digest("hex"),
        hasPreview: await has(path.join(at, "preview.json")),
        hasThumb: await has(path.join(at, "thumb.webp")),
        approved,
      }),
    );
  }
  return entries;
}
