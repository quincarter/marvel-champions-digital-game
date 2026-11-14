/**
 * Loads a pack's `preview.json` for the Mod Store (docs/custom-content-packs.md §11.5, §11.6): fetched through the same
 * path as the catalog and the zip (`pack-fetch.ts`, so a packaged app uses its native HTTP stack), size-capped,
 * validated in a worker (`pack-preview.worker.ts`; inline where there is no worker), and kept in memory for the
 * session and in `localStorage` next to the catalog's own saved copy, so a pack's page and tile open offline.
 * A preview that cannot be read is simply absent: the store falls back to its letter tile and a text-only page.
 */
import { PACK_PREVIEW_MAX_BYTES } from "@mc/content";
import { packFetchFor } from "./pack-fetch.js";
import type { FetchLike } from "./catalog.js";
import { parsePackPreviewText, type ParsedPackPreview } from "./pack-preview.js";

/** What crosses the worker boundary: a preview with its image set as an array. */
export type WirePreview = Omit<ParsedPackPreview, "images"> & { readonly images: readonly string[] };
export interface PreviewWorkerRequest {
  readonly id: number;
  readonly text: string;
  readonly packId: string;
}
export interface PreviewWorkerReply {
  readonly id: number;
  readonly preview: WirePreview | null;
}

export const PREVIEW_CACHE_KEY = "mc-pack-previews";
/** The saved copies' budget: the newest few, and never more than this much text. */
const CACHE_ENTRIES = 24;
const CACHE_BYTES = 1_500_000;
/** Previews fetched at once. */
const MAX_PARALLEL = 3;

const memory = new Map<string, ParsedPackPreview | null>();
const waiting = new Map<string, Promise<ParsedPackPreview | undefined>>();
const listeners = new Set<() => void>();
let running = 0;
const queue: (() => void)[] = [];

const fromWire = (wire: WirePreview): ParsedPackPreview => ({ ...wire, images: new Set(wire.images) });

type Store = Pick<Storage, "getItem" | "setItem"> | null;
function defaultStorage(): Store {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

interface SavedCopy {
  readonly url: string;
  readonly packId: string;
  readonly text: string;
}

function readSaved(storage: Store): SavedCopy[] {
  try {
    const raw = storage?.getItem(PREVIEW_CACHE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list.filter((one): one is SavedCopy => typeof one?.url === "string" && typeof one?.text === "string")
      : [];
  } catch {
    return [];
  }
}

function save(storage: Store, copy: SavedCopy): void {
  if (!storage) return;
  let list = [copy, ...readSaved(storage).filter((one) => one.url !== copy.url)].slice(0, CACHE_ENTRIES);
  let total = 0;
  list = list.filter((one) => (total += one.text.length) <= CACHE_BYTES);
  try {
    storage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(list));
  } catch {
    // Quota or private mode: the preview still works this session.
  }
}

/** The preview if it is already in memory (null: asked for and unreadable, undefined: not asked for yet). */
export function previewInMemory(url: string): ParsedPackPreview | null | undefined {
  return memory.get(url);
}

/** Calls `listener` whenever a preview arrives, so a screen can redraw. */
export function onPreviewArrived(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, (preview: WirePreview | null) => void>();

function spawn(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === "undefined") return null;
  try {
    const made = new Worker(new URL("./pack-preview.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-pack-preview",
    });
    made.onmessage = (event: MessageEvent<PreviewWorkerReply>) => {
      pending.get(event.data.id)?.(event.data.preview);
      pending.delete(event.data.id);
    };
    made.onerror = () => {
      // The worker is unusable: answer what it held, and parse here from now on.
      worker = null;
      made.terminate();
      for (const answer of pending.values()) answer(null);
      pending.clear();
    };
    worker = made;
  } catch {
    worker = null;
  }
  return worker;
}

function parse(text: string, packId: string): Promise<ParsedPackPreview | undefined> {
  const made = spawn();
  if (!made) return Promise.resolve(parsePackPreviewText(text, packId));
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, (wire) => resolve(wire ? fromWire(wire) : undefined));
    made.postMessage({ id, text, packId } satisfies PreviewWorkerRequest);
  });
}

export interface PreviewDeps {
  readonly fetch?: FetchLike;
  readonly storage?: Store;
}

async function readText(response: Response): Promise<string | undefined> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > PACK_PREVIEW_MAX_BYTES) return undefined;
  const text = await response.text();
  return text.length > PACK_PREVIEW_MAX_BYTES ? undefined : text;
}

async function fetchPreview(url: string, packId: string, deps: PreviewDeps): Promise<ParsedPackPreview | undefined> {
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  try {
    const response = await (deps.fetch ?? packFetchFor())(url);
    if (!response.ok) throw new Error(`Preview request failed (${response.status})`);
    const text = await readText(response);
    const parsed = text === undefined ? undefined : await parse(text, packId);
    if (text !== undefined && parsed) save(storage, { url, packId, text });
    return parsed;
  } catch {
    // Offline: the last saved copy, when there is one.
    const saved = readSaved(storage).find((one) => one.url === url);
    return saved ? await parse(saved.text, packId) : undefined;
  }
}

/**
 * Starts loading the preview at `url` unless it is loaded or loading, at most `MAX_PARALLEL` at once. Resolves to the
 * preview or undefined; `previewInMemory` and `onPreviewArrived` are how a scene picks it up.
 */
export function requestPreview(
  url: string,
  packId: string,
  deps: PreviewDeps = {},
): Promise<ParsedPackPreview | undefined> {
  const known = memory.get(url);
  if (known !== undefined) return Promise.resolve(known ?? undefined);
  const inFlight = waiting.get(url);
  if (inFlight) return inFlight;
  const promise = new Promise<ParsedPackPreview | undefined>((resolve) => {
    const start = (): void => {
      running += 1;
      void fetchPreview(url, packId, deps).then((preview) => {
        running -= 1;
        memory.set(url, preview ?? null);
        waiting.delete(url);
        queue.shift()?.();
        resolve(preview);
        for (const listener of [...listeners]) listener();
      });
    };
    if (running < MAX_PARALLEL) start();
    else queue.push(start);
  });
  waiting.set(url, promise);
  return promise;
}

/** Test seam: forgets every preview. */
export function resetPreviews(): void {
  memory.clear();
  waiting.clear();
  queue.length = 0;
  running = 0;
}
