/**
 * Installing one pack from the catalog (docs/custom-content-packs.md §7.2): download the zip (trying `zipFallback` if
 * the first address fails), verify and unpack it in a worker, then hand it to the `PackStorage`, which writes the
 * manifest last. Any failure throws a `PackInstallError` and leaves nothing installed.
 */
import type { PackIndexEntry } from "@mc/content";
import type { FetchLike } from "./catalog.js";
import type { InstalledPack, PackStorage } from "./pack-store.js";
import { unpackInWorker, type UnpackWorkerFactory } from "./unpack-client.js";
import { PackInstallError, type UnpackExpect, type UnpackProgress } from "./unpack-pack.js";

export type InstallProgress =
  | { readonly phase: "download"; readonly received: number; readonly total: number }
  | { readonly phase: "verify-zip" }
  | { readonly phase: "unzip" }
  | { readonly phase: "verify-files"; readonly done: number; readonly total: number }
  | { readonly phase: "store" }
  | { readonly phase: "done" };

export interface InstallDeps {
  readonly store: PackStorage;
  readonly fetch?: FetchLike;
  /** The worker to unpack in; the default spawns the real one and falls back to running here. */
  readonly workerFactory?: UnpackWorkerFactory;
  readonly onProgress?: (progress: InstallProgress) => void;
}

/** Reads a response body, reporting bytes as they arrive. */
async function readBody(response: Response, total: number, onBytes: (received: number) => void): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onBytes(bytes.byteLength);
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onBytes(received);
    if (received > Math.max(total, 1) * 2 + 1024) {
      void reader.cancel();
      throw new PackInstallError("zip-size", "The download is larger than the catalog said");
    }
  }
  const out = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

async function download(
  urls: readonly string[],
  total: number,
  doFetch: FetchLike,
  onBytes: (received: number) => void,
): Promise<Uint8Array> {
  let lastError: unknown;
  for (const url of urls) {
    try {
      const response = await doFetch(url);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      return await readBody(response, total, onBytes);
    } catch (error) {
      if (error instanceof PackInstallError) throw error;
      lastError = error;
    }
  }
  const reason = lastError instanceof Error ? lastError.message : "network error";
  throw new PackInstallError("download", `Could not download the pack (${reason})`);
}

/** Installs `version` (default: the entry's latest) of a catalog pack. */
export async function installPack(
  entry: PackIndexEntry,
  deps: InstallDeps,
  version: string = entry.latest,
): Promise<InstalledPack> {
  const info = entry.versions[version];
  if (!info) throw new PackInstallError("mismatch", `${entry.id} has no version ${version} in the catalog`);
  const report = deps.onProgress ?? (() => {});
  const doFetch: FetchLike = deps.fetch ?? ((url, init) => fetch(url, init));
  const expect: UnpackExpect = { id: entry.id, version, zipBytes: info.zipBytes, zipSha256: info.zipSha256 };

  const urls = info.zipFallback ? [info.zip, info.zipFallback] : [info.zip];
  const zip = await download(urls, info.zipBytes, doFetch, (received) =>
    report({ phase: "download", received, total: info.zipBytes }),
  );

  const unpacked = await unpackInWorker(
    zip,
    expect,
    (progress: UnpackProgress) => report({ phase: progress.step, ...progress } as InstallProgress),
    deps.workerFactory,
  );

  report({ phase: "store" });
  let installed: InstalledPack;
  try {
    installed = await deps.store.install(unpacked.manifest, unpacked.files);
  } catch (error) {
    throw new PackInstallError("store", `Could not save the pack (${error instanceof Error ? error.message : error})`);
  }
  report({ phase: "done" });
  return installed;
}
