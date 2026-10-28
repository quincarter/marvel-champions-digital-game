// The media bundles (issue #495): card art, music and art live as zip files on GitHub Releases, not in git.
// `assets/manifest.json` names each bundle's release; `pnpm assets:fetch` (scripts/assets-fetch.mjs) puts the files
// back where the code expects them, and `pnpm assets:pack` (scripts/assets-pack.mjs) zips and uploads a changed one.
//
// Layout:
//   - a bundle owns the media files under one folder (`dir`, from the repo root), optionally only those whose name
//     starts with one of its `prefixes` (card scans are named by card code, and a code's first two digits are its
//     pack). Files that aren't media (README, SOURCE.md, focus.json, the TSV manifests, .gitkeep) stay in git.
//   - `kind: "archive"` bundles (artifacts/: QA and design screenshots) hold every file and are fetched only by name.
//   - a release tag is the bundle's name plus the first 12 hex digits of the zip's sha256, so a release never changes
//     once uploaded and an old commit's manifest still downloads what it built with. Old releases are never deleted.
//
// The cache is shared by every checkout on the machine (`MC_ASSETS_CACHE`, else %LOCALAPPDATA%\mc-assets or
// ~/.cache/mc-assets): `zips/<sha256>.zip` as downloaded, `unpacked/<sha256>/` with its files and
// `unpacked/<sha256>.json` (the file list, written last, so its presence means the unpack finished). A checkout gets
// hard links to the unpacked files, so a second worktree costs no download and almost no disk; where a hard link
// can't be made (another drive, `MC_ASSETS_LINK=copy`) the file is copied. Hard links rather than symlinked
// folders because Vite resolves a symlink to its real path, and its dev server refuses files outside the workspace.
// A hard link shares its bytes with the cache: replace a file (write a new one, or delete and re-create), never edit
// one in place, or every checkout sees the edit.
//
// Zips are STORE-only (the media is already compressed), with sorted entries and a fixed 1980-01-01 timestamp, so
// the same files always give the same bytes and the same sha256.

import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

export const MANIFEST_PATH = "assets/manifest.json";
/** Per-checkout record of what `assets:fetch` installed (gitignored). */
export const STATE_PATH = "assets/.fetched.json";
export const DEFAULT_REPO = "quincarter/marvel-champions-content";
/** GitHub's limit on one release asset. */
export const MAX_BUNDLE_BYTES = 2 * 1024 ** 3;

export const MEDIA_FILE = /\.(png|jpe?g|webp|avif|gif|mp3|ogg|wav|m4a|flac|opus)$/i;
const NAME = /^[a-z0-9][a-z0-9-]*$/;
const SHA256 = /^[0-9a-f]{64}$/;

// ---------------------------------------------------------------------------------------------------------------
// The manifest

/**
 * Checks a parsed `assets/manifest.json` and returns it. Throws on a shape error, a duplicate name, or two bundles
 * that could claim the same file (the same folder with overlapping prefixes, or nested folders).
 */
export function parseManifest(json) {
  const fail = (message) => {
    throw new Error(`${MANIFEST_PATH}: ${message}`);
  };
  if (!json || typeof json !== "object") fail("not an object");
  const repo = json.repo ?? DEFAULT_REPO;
  if (typeof repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(repo)) fail(`repo must be "owner/name" (got ${repo})`);
  if (!Array.isArray(json.bundles)) fail("bundles must be an array");
  const seen = new Set();
  const bundles = json.bundles.map((b, i) => {
    const at = `bundles[${i}]${b?.name ? ` (${b.name})` : ""}`;
    if (!b || typeof b !== "object") fail(`${at} is not an object`);
    if (typeof b.name !== "string" || !NAME.test(b.name)) fail(`${at}: name must be lower-case letters, digits, -`);
    if (seen.has(b.name)) fail(`${at}: duplicate name`);
    seen.add(b.name);
    if (typeof b.group !== "string" || !NAME.test(b.group)) fail(`${at}: group must be lower-case letters, digits, -`);
    if (typeof b.dir !== "string" || !isSafeRelative(b.dir)) fail(`${at}: dir must be a relative path inside the repo`);
    const kind = b.kind ?? "media";
    if (kind !== "media" && kind !== "archive") fail(`${at}: kind must be "media" or "archive"`);
    if (b.prefixes !== undefined) {
      if (!Array.isArray(b.prefixes) || b.prefixes.length === 0 || b.prefixes.some((p) => typeof p !== "string" || !p))
        fail(`${at}: prefixes must be a non-empty list of strings`);
    }
    const packed = b.sha256 !== undefined;
    if (packed) {
      if (typeof b.sha256 !== "string" || !SHA256.test(b.sha256)) fail(`${at}: sha256 must be 64 hex digits`);
      if (typeof b.tag !== "string" || !b.tag) fail(`${at}: a packed bundle needs its release tag`);
      if (typeof b.file !== "string" || !/^[\w.-]+\.zip$/.test(b.file)) fail(`${at}: file must be a .zip name`);
      if (!Number.isInteger(b.size) || b.size <= 0 || b.size > MAX_BUNDLE_BYTES) fail(`${at}: bad size ${b.size}`);
    }
    return { ...b, dir: toPosix(b.dir), kind };
  });
  for (let i = 0; i < bundles.length; i++) {
    for (let j = i + 1; j < bundles.length; j++) {
      const a = bundles[i];
      const b = bundles[j];
      if (a.dir === b.dir) {
        if (!a.prefixes || !b.prefixes) fail(`${a.name} and ${b.name} both own all of ${a.dir}`);
        const clash = a.prefixes.find((p) => b.prefixes.some((q) => p.startsWith(q) || q.startsWith(p)));
        if (clash !== undefined) fail(`${a.name} and ${b.name} overlap on prefix "${clash}" in ${a.dir}`);
      } else if (isInside(a.dir, b.dir) || isInside(b.dir, a.dir)) {
        fail(`${a.name} (${a.dir}) and ${b.name} (${b.dir}) are nested`);
      }
    }
  }
  return { ...json, repo, bundles };
}

export async function readManifest(root) {
  return parseManifest(JSON.parse(await fs.readFile(path.join(root, MANIFEST_PATH), "utf8")));
}

/**
 * The bundles a selector names. `all` (or nothing) is every media bundle; `none` is nothing; otherwise a
 * comma- or space-separated list of group and bundle names (an archive bundle is fetched only when listed).
 */
export function selectBundles(manifest, selector) {
  const words = String(selector ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (words.length === 0 || words.includes("all")) {
    const media = manifest.bundles.filter((b) => b.kind === "media");
    const extra = words.filter((w) => w !== "all");
    return [...media, ...manifest.bundles.filter((b) => b.kind === "archive" && extra.includes(b.name))];
  }
  if (words.includes("none")) return [];
  const unknown = words.filter((w) => !manifest.bundles.some((b) => b.name === w || b.group === w));
  if (unknown.length > 0) throw new Error(`no bundle or group named ${unknown.join(", ")} in ${MANIFEST_PATH}`);
  return manifest.bundles.filter((b) => words.includes(b.name) || (b.kind === "media" && words.includes(b.group)));
}

/** Whether a file (its path relative to the bundle's `dir`, with forward slashes) belongs to the bundle. */
export function bundleOwns(bundle, relative) {
  if (bundle.kind === "media" && !MEDIA_FILE.test(relative)) return false;
  return !bundle.prefixes || bundle.prefixes.some((p) => relative.startsWith(p));
}

export function releaseUrl(repo, bundle) {
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(bundle.tag)}/${encodeURIComponent(bundle.file)}`;
}

export function tagFor(name, sha256) {
  return `${name}-${sha256.slice(0, 12)}`;
}

/** The machine-wide cache folder. */
export function cacheDir(env = process.env, platform = process.platform, home = os.homedir()) {
  if (env.MC_ASSETS_CACHE) return path.resolve(env.MC_ASSETS_CACHE);
  if (platform === "win32") return path.join(env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "mc-assets");
  return path.join(env.XDG_CACHE_HOME || path.join(home, ".cache"), "mc-assets");
}

// ---------------------------------------------------------------------------------------------------------------
// Files

function toPosix(p) {
  return p.split(path.sep).join("/").replace(/\\/g, "/");
}

function isSafeRelative(p) {
  const posix = toPosix(p);
  return posix !== "" && !posix.startsWith("/") && !/^[a-zA-Z]:/.test(posix) && !posix.split("/").includes("..");
}

function isInside(child, parent) {
  return child.startsWith(`${parent}/`);
}

/** Every file under `dir`, as sorted forward-slash paths relative to it. A missing folder has none. */
export async function listFiles(dir) {
  const out = [];
  async function walk(abs, rel) {
    let entries;
    try {
      entries = await fs.readdir(abs, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(abs, entry.name), childRel);
      else if (entry.isFile()) out.push(childRel);
    }
  }
  await walk(dir, "");
  return out.sort(compareNames);
}

/** Byte order, not locale order, so every machine sorts the same. */
function compareNames(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export async function sha256File(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

// ---------------------------------------------------------------------------------------------------------------
// Zip (STORE only, no zip64: a bundle stays under 2 GiB and 65535 files)

const DOS_DATE_1980 = 0x21; // 1980-01-01
const UTF8_FLAG = 0x0800;

/**
 * Writes `files` (paths relative to `baseDir`) into a STORE zip at `out`, in sorted order with a fixed timestamp.
 * Returns the zip's size and sha256.
 */
export async function writeZip(baseDir, files, out) {
  const names = [...files].sort(compareNames);
  if (names.length > 0xffff) throw new Error(`${names.length} files is more than a zip without zip64 holds`);
  const hash = createHash("sha256");
  const handle = await fs.open(out, "w");
  let offset = 0;
  const write = async (buffer) => {
    hash.update(buffer);
    await handle.write(buffer);
    offset += buffer.length;
  };
  const central = [];
  try {
    for (const name of names) {
      if (!isSafeRelative(name)) throw new Error(`unsafe path in bundle: ${name}`);
      const data = await fs.readFile(path.join(baseDir, name));
      const nameBytes = Buffer.from(name, "utf8");
      const crc = zlib.crc32(data);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(UTF8_FLAG, 6);
      local.writeUInt16LE(0, 8); // STORE
      local.writeUInt16LE(0, 10); // time
      local.writeUInt16LE(DOS_DATE_1980, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(nameBytes.length, 26);
      local.writeUInt16LE(0, 28);
      const localOffset = offset;
      if (localOffset + 30 + nameBytes.length + data.length > 0xffffffff) throw new Error("bundle passes 4 GiB");
      await write(local);
      await write(nameBytes);
      await write(data);
      const entry = Buffer.alloc(46);
      entry.writeUInt32LE(0x02014b50, 0);
      entry.writeUInt16LE(20, 4);
      entry.writeUInt16LE(20, 6);
      entry.writeUInt16LE(UTF8_FLAG, 8);
      entry.writeUInt16LE(0, 10);
      entry.writeUInt16LE(0, 12);
      entry.writeUInt16LE(DOS_DATE_1980, 14);
      entry.writeUInt32LE(crc, 16);
      entry.writeUInt32LE(data.length, 20);
      entry.writeUInt32LE(data.length, 24);
      entry.writeUInt16LE(nameBytes.length, 28);
      // extra, comment, disk, internal and external attributes: all 0
      entry.writeUInt32LE(localOffset, 42);
      central.push(entry, nameBytes);
    }
    const cdOffset = offset;
    for (const part of central) await write(part);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(names.length, 8);
    end.writeUInt16LE(names.length, 10);
    end.writeUInt32LE(offset - cdOffset, 12);
    end.writeUInt32LE(cdOffset, 16);
    await write(end);
  } finally {
    await handle.close();
  }
  return { size: offset, sha256: hash.digest("hex"), files: names.length };
}

/** The entries of a zip written by `writeZip`: name, data offset, size and crc. */
export async function readZipEntries(zipPath) {
  const handle = await fs.open(zipPath, "r");
  try {
    const { size } = await handle.stat();
    const tailLength = Math.min(size, 22 + 0xffff);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, size - tailLength);
    let eocd = -1;
    for (let i = tailLength - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error(`${zipPath}: not a zip file`);
    const count = tail.readUInt16LE(eocd + 10);
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    const cd = Buffer.alloc(cdSize);
    await handle.read(cd, 0, cdSize, cdOffset);
    const entries = [];
    let at = 0;
    for (let i = 0; i < count; i++) {
      if (cd.readUInt32LE(at) !== 0x02014b50) throw new Error(`${zipPath}: broken central directory`);
      const method = cd.readUInt16LE(at + 10);
      const crc = cd.readUInt32LE(at + 16);
      const compressed = cd.readUInt32LE(at + 20);
      const length = cd.readUInt32LE(at + 24);
      const nameLength = cd.readUInt16LE(at + 28);
      const extraLength = cd.readUInt16LE(at + 30);
      const commentLength = cd.readUInt16LE(at + 32);
      const localOffset = cd.readUInt32LE(at + 42);
      const name = cd.toString("utf8", at + 46, at + 46 + nameLength);
      at += 46 + nameLength + extraLength + commentLength;
      if (name.endsWith("/")) continue; // a folder entry
      if (method !== 0 || compressed !== length)
        throw new Error(`${zipPath}: ${name} is compressed; bundles are STORE`);
      if (!isSafeRelative(name)) throw new Error(`${zipPath}: unsafe path ${name}`);
      const local = Buffer.alloc(30);
      await handle.read(local, 0, 30, localOffset);
      if (local.readUInt32LE(0) !== 0x04034b50) throw new Error(`${zipPath}: broken local header for ${name}`);
      const dataOffset = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      entries.push({ name, offset: dataOffset, size: length, crc });
    }
    return entries;
  } finally {
    await handle.close();
  }
}

/** Unpacks a zip into `dest` (which should be empty), checking each file's crc. Returns the sorted file list. */
export async function extractZip(zipPath, dest) {
  const entries = await readZipEntries(zipPath);
  const handle = await fs.open(zipPath, "r");
  try {
    for (const entry of entries) {
      const data = Buffer.alloc(entry.size);
      if (entry.size > 0) await handle.read(data, 0, entry.size, entry.offset);
      if (zlib.crc32(data) !== entry.crc) throw new Error(`${zipPath}: ${entry.name} fails its crc`);
      const target = path.join(dest, ...entry.name.split("/"));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, data);
    }
  } finally {
    await handle.close();
  }
  return entries.map((e) => e.name).sort(compareNames);
}

// ---------------------------------------------------------------------------------------------------------------
// Installing into a checkout

/**
 * What to do with one bundle file at `target` in the checkout, given what fetch installed there last time
 * (`previous`: `{ size, mtimeMs }` or undefined) and the cached copy (`source`).
 *   - "same": already this exact file (a hard link to it, or the same bytes); just record it.
 *   - "install": nothing there, or the file fetch put there last time and nobody touched since; link it.
 *   - "keep": a file fetch didn't install, or one changed since, with different bytes: a local edit, left alone.
 */
export async function decide(target, source, previous) {
  let current;
  try {
    current = await fs.stat(target);
  } catch (error) {
    if (error.code === "ENOENT") return "install";
    throw error;
  }
  if (await sameFile(target, source)) return "same";
  const cached = await fs.stat(source);
  if (previous && previous.size === current.size && previous.mtimeMs === current.mtimeMs) return "install";
  if (current.size === cached.size && (await sha256File(target)) === (await sha256File(source))) return "same";
  return "keep";
}

/** Whether two paths are one file (hard links to the same inode). Bigint stats: an NTFS file index passes 2^53. */
export async function sameFile(a, b) {
  const [x, y] = await Promise.all([fs.stat(a, { bigint: true }), fs.stat(b, { bigint: true })]);
  return x.ino !== 0n && x.ino === y.ino && x.dev === y.dev;
}

/** Hard-links `source` to `target` (replacing it), or copies it when a link can't be made or `copy` is set. */
export async function place(source, target, copy = false) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rm(target, { force: true });
  if (!copy) {
    try {
      await fs.link(source, target);
      return "link";
    } catch (error) {
      if (!["EXDEV", "EPERM", "ENOTSUP", "EMLINK", "EACCES"].includes(error.code)) throw error;
    }
  }
  await fs.copyFile(source, target);
  return "copy";
}

/**
 * Puts an unpacked bundle (`sourceDir`, its `files`) into `targetDir`, and removes the files the previous version
 * installed that this one no longer has (only if untouched since). `previousFiles` maps a relative path to the
 * `{ size, mtimeMs }` recorded when it was installed. `ownedElsewhere(rel)` says another bundle owns a path now (a
 * pack prefix moved to another cycle's bundle), which this one then leaves alone. Returns the new record and counts.
 */
export async function installBundle({
  sourceDir,
  files,
  targetDir,
  previousFiles = {},
  copy = false,
  force = false,
  ownedElsewhere = () => false,
}) {
  const record = {};
  const counts = { installed: 0, same: 0, kept: [], removed: 0 };
  for (const rel of files) {
    const source = path.join(sourceDir, ...rel.split("/"));
    const target = path.join(targetDir, ...rel.split("/"));
    let action = await decide(target, source, previousFiles[rel]);
    if (action === "keep" && force) action = "install";
    if (action === "keep") {
      counts.kept.push(rel);
      continue;
    }
    if (action === "install") {
      await place(source, target, copy);
      counts.installed++;
    } else {
      counts.same++;
    }
    const { size, mtimeMs } = await fs.stat(target);
    record[rel] = { size, mtimeMs };
  }
  const now = new Set(files);
  for (const [rel, previous] of Object.entries(previousFiles)) {
    if (now.has(rel) || ownedElsewhere(rel)) continue;
    const target = path.join(targetDir, ...rel.split("/"));
    try {
      const current = await fs.stat(target);
      if (current.size !== previous.size || current.mtimeMs !== previous.mtimeMs) continue; // edited: keep it
      await fs.rm(target);
      counts.removed++;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return { record, counts };
}

/** A suffix no other process or call is using. */
export function unique() {
  return `${process.pid}-${randomUUID().slice(0, 8)}`;
}

/** Writes a file under a temporary name and renames it into place, so a crash never leaves half of it. */
export async function writeFileAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${unique()}`;
  await fs.writeFile(temp, data);
  await fs.rename(temp, file);
}

/** Parses a JSON file; undefined when it is missing or unreadable (a crash mid-write, before writes were atomic). */
export async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/** An unreadable state starts over: every bundle is checked again, and files already in place are adopted. */
export async function readState(root) {
  return (await readJson(path.join(root, STATE_PATH))) ?? { bundles: {} };
}

export async function writeState(root, state) {
  await writeFileAtomic(path.join(root, STATE_PATH), `${JSON.stringify(state)}\n`);
}

// ---------------------------------------------------------------------------------------------------------------
// The shared cache's unpacked bundles

const UNPACKED_INDEX = ".mc-index.json";

/**
 * A cached unpacked bundle's file list, if the folder is whole: its index exists and every file still has the size
 * and time it was unpacked with. Anything else (no folder, a half-written index, a file rewritten in place through a
 * hard link in some checkout) is undefined, and the caller unpacks again from the zip.
 */
export async function readUnpacked(dir) {
  const index = await readJson(path.join(dir, UNPACKED_INDEX));
  if (!index || !Array.isArray(index.files) || !index.stats || typeof index.stats !== "object") return undefined;
  for (const rel of index.files) {
    try {
      const { size, mtimeMs } = await fs.stat(path.join(dir, ...rel.split("/")));
      const recorded = index.stats[rel];
      if (!recorded || recorded.size !== size || recorded.mtimeMs !== mtimeMs) return undefined;
    } catch {
      return undefined;
    }
  }
  return index.files;
}

/**
 * Unpacks `zip` into the cache folder `dir`. Safe against another checkout doing the same at once: each unpacks and
 * indexes its own temporary folder and renames it into place whole, so a folder at `dir` with an index is always
 * finished, and one already there wins. A broken folder is moved aside first, never emptied in place.
 */
export async function unpackInto(zip, dir) {
  const temp = `${dir}.tmp-${unique()}`;
  await fs.rm(temp, { recursive: true, force: true });
  await fs.mkdir(temp, { recursive: true });
  const files = await extractZip(zip, temp);
  const stats = {};
  for (const rel of files) {
    const { size, mtimeMs } = await fs.stat(path.join(temp, ...rel.split("/")));
    stats[rel] = { size, mtimeMs };
  }
  await fs.writeFile(path.join(temp, UNPACKED_INDEX), JSON.stringify({ files, stats }));
  const existing = await readUnpacked(dir);
  if (existing) {
    await fs.rm(temp, { recursive: true, force: true });
    return existing;
  }
  const stale = `${dir}.stale-${unique()}`;
  try {
    await fs.rename(dir, stale);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await fs.rename(temp, dir);
  } catch (error) {
    // Another process put its folder there between our check and our rename: use it if it is whole.
    const theirs = await readUnpacked(dir);
    await fs.rm(temp, { recursive: true, force: true });
    if (theirs) return theirs;
    throw error;
  } finally {
    await fs.rm(stale, { recursive: true, force: true });
  }
  return files;
}

/**
 * Whether a bundle is already installed as the manifest wants it: the state names its sha256 and every file it
 * recorded is still there with the recorded size and time. Cheap: no hashing.
 */
export async function isCurrent(root, bundle, state) {
  const entry = state.bundles?.[bundle.name];
  if (!entry || entry.sha256 !== bundle.sha256 || entry.complete !== true) return false;
  for (const [rel, recorded] of Object.entries(entry.files ?? {})) {
    try {
      const current = await fs.stat(path.join(root, bundle.dir, ...rel.split("/")));
      if (current.size !== recorded.size || current.mtimeMs !== recorded.mtimeMs) return false;
    } catch {
      return false;
    }
  }
  return true;
}
