/**
 * What a deploy, a cleanup and the sweep change in the bucket, decided from plain data so the tests can check it
 * without a network. src/deploy/cli.ts does the listing and the calls.
 */

import { FILES_FILE, PREVIEW_FILE, prPrefix, SHARED_PREFIX } from "../layout.ts";
import type { RemoteObject } from "./r2-api.ts";

/** A file the deploy wants in the bucket: one from `dist/`, or one it generates (`files.json`, `preview.json`). */
export interface LocalFile {
  readonly key: string;
  readonly md5: string;
  readonly size: number;
  readonly contentType: string;
  /** Where to read it from; absent for a generated file, which carries `body`. */
  readonly file?: string;
  readonly body?: Uint8Array;
}

export interface DeployPlan {
  /** Files to upload, missing from the bucket or changed. */
  readonly uploads: readonly LocalFile[];
  /** Files already there with the same MD5. */
  readonly unchanged: number;
  /** The PR's own files the new build no longer has. */
  readonly deletes: readonly string[];
}

/**
 * `local` is everything the build wants (without `preview.json`, which the deploy writes last); `remote` is the listing
 * of every prefix those keys fall under. The PR's own files the build dropped go; shared files stay for the sweep.
 */
export function planDeploy(pr: number, local: readonly LocalFile[], remote: readonly RemoteObject[]): DeployPlan {
  const remoteByKey = new Map(remote.map((object) => [object.key, object]));
  const wanted = new Map<string, LocalFile>();
  for (const file of local) if (!wanted.has(file.key)) wanted.set(file.key, file);
  const uploads: LocalFile[] = [];
  let unchanged = 0;
  for (const file of wanted.values()) {
    const there = remoteByKey.get(file.key);
    if (there && there.etag === file.md5 && there.size === file.size) unchanged++;
    else uploads.push(file);
  }
  const own = prPrefix(pr);
  const keep = new Set([...wanted.keys(), `${own}${PREVIEW_FILE}`, `${own}${FILES_FILE}`]);
  const deletes = remote
    .map((object) => object.key)
    .filter((key) => key.startsWith(own) && !keep.has(key))
    .sort();
  return { uploads, unchanged, deletes };
}

/** `pr-<n>/files.json`: the sorted shared keys the build uses. The sweep keeps every key an open PR lists. */
export function filesManifest(local: readonly LocalFile[]): string {
  const shared = [...new Set(local.map((file) => file.key).filter((key) => key.startsWith(SHARED_PREFIX)))].sort();
  return `${JSON.stringify({ shared }, null, 0)}\n`;
}

/** The shared keys a `files.json` lists; null when it can't be read, which stops the sweep deleting shared files. */
export function parseFilesManifest(text: string | null): readonly string[] | null {
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text) as { shared?: unknown };
    if (!Array.isArray(parsed.shared) || !parsed.shared.every((key) => typeof key === "string")) return null;
    return parsed.shared as string[];
  } catch {
    return null;
  }
}

/** The PR number of a `pr-<n>/` folder, or null for anything else. */
export function prOfFolder(folder: string): number | null {
  const match = /^pr-([1-9][0-9]*)\/$/.exec(folder);
  return match ? Number(match[1]) : null;
}

/** An upload newer than this is never swept: a deploy may be between its upload and its `files.json`. */
export const SWEEP_GRACE_MS = 24 * 60 * 60_000;

export interface SweepPlan {
  /** Pull requests whose folder goes: closed, or not in the open list. */
  readonly closed: readonly number[];
  /** Shared files no open PR's `files.json` lists, older than the grace period; empty when a manifest is unreadable. */
  readonly sharedDeletes: readonly string[];
}

/**
 * `folders`: the bucket's `pr-<n>/` folders. `open`: the repository's open PRs. `manifests`: each remaining PR's
 * `files.json` keys, or null when it couldn't be read. `shared`: the listing of `shared/`.
 */
export function planSweep(input: {
  readonly folders: readonly number[];
  readonly open: ReadonlySet<number>;
  readonly manifests: ReadonlyMap<number, readonly string[] | null>;
  readonly shared: readonly RemoteObject[];
  readonly now: number;
  readonly graceMs?: number;
}): SweepPlan {
  const closed = input.folders.filter((pr) => !input.open.has(pr)).sort((a, b) => a - b);
  const live = input.folders.filter((pr) => input.open.has(pr));
  const referenced = new Set<string>();
  for (const pr of live) {
    const keys = input.manifests.get(pr);
    // A preview whose list can't be read might use any shared file: delete none this time.
    if (!keys) return { closed, sharedDeletes: [] };
    for (const key of keys) referenced.add(key);
  }
  const grace = input.graceMs ?? SWEEP_GRACE_MS;
  const sharedDeletes = input.shared
    .filter((object) => !referenced.has(object.key) && input.now - object.lastModified >= grace)
    .map((object) => object.key)
    .sort();
  return { closed, sharedDeletes };
}
