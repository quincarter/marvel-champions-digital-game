// The Mod Store catalog, `index.json` (docs/custom-content-packs.md §11.5; `PackIndex` in
// packages/content/src/schema/packs.ts): building one pack's entry from what `mc-pack build` wrote, and upserting the
// packs a publish run built into the catalog already on R2.
//
// Used by scripts/publish-pack-index.mjs (the publish-packs workflow).
//
// Rules for an upsert:
//   - packs this run didn't build stay as they are, whoever published them (the registry repo publishes to the same
//     catalog);
//   - a built pack keeps its older versions, so saves that used them still load;
//   - a version already listed with a different zip sha256 is an error: published versions never change;
//   - `approved` keeps the date the pack was first listed;
//   - the pack's name, summary, thumbnail and the rest follow its newest version, and `latest` is the newest version
//     by SemVer precedence;
//   - `withdrawn` stays as it is: publishing (or re-publishing) a version never lists a withdrawn pack again. Only an
//     explicit `unwithdraw` (the workflow's manual input) clears it, for any pack in the catalog, built this run or not.

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
 * Compares two versions by SemVer 2.0.0 precedence (semver.org §11): negative when `a` is older.
 * `major.minor.patch` compare as numbers; a version with a pre-release part sorts before the same version without
 * one; pre-release parts compare identifier by identifier (dot-separated), numeric identifiers as numbers and below
 * alphanumeric ones, which compare in ASCII order, and a shorter list sorts first when the shared identifiers are
 * equal. Build metadata (`+…`) is ignored. The registry repo's scripts/update-index.mjs carries the same function.
 */
export function compareVersions(a, b) {
  const parse = (v) => {
    const text = String(v).split("+")[0];
    const dash = text.indexOf("-");
    const core = dash < 0 ? text : text.slice(0, dash);
    const pre = dash < 0 ? [] : text.slice(dash + 1).split(".");
    return { nums: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  if (x.pre.length === 0 || y.pre.length === 0) return Math.sign(y.pre.length) - Math.sign(x.pre.length);
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const d = compareIdentifiers(x.pre[i], y.pre[i]);
    if (d !== 0) return d;
  }
  return 0;
}

const NUMERIC = /^\d+$/;

/** One pre-release identifier against another; `undefined` (that list ran out first) sorts first. */
function compareIdentifiers(p, q) {
  if (p === q) return 0;
  if (p === undefined) return -1;
  if (q === undefined) return 1;
  const pn = NUMERIC.test(p);
  const qn = NUMERIC.test(q);
  if (pn && qn) {
    // Digit strings of any length: without leading zeros, the longer one is larger.
    const ps = p.replace(/^0+(?=\d)/, "");
    const qs = q.replace(/^0+(?=\d)/, "");
    if (ps.length !== qs.length) return ps.length < qs.length ? -1 : 1;
    return ps === qs ? 0 : ps < qs ? -1 : 1;
  }
  if (pn) return -1;
  if (qn) return 1;
  return p < q ? -1 : 1;
}

/**
 * Returns a new catalog: `current` (the index.json on R2, or undefined when there is none yet) with `built` upserted.
 * `built` is a list of `packIndexEntry` results, one version each. `today` is `YYYY-MM-DD`, `now` an ISO time.
 * `unwithdraw` lists pack ids to list again; an id the catalog doesn't have is an error.
 */
export function upsertPackIndex(current, built, { today, now, unwithdraw = [] }) {
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
      withdrawn: previous?.withdrawn ?? false,
    });
  }
  for (const id of unwithdraw) {
    const pack = byId.get(id);
    if (!pack) throw new Error(`cannot unwithdraw ${id}: the catalog has no such pack`);
    byId.set(id, { ...pack, withdrawn: false });
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
