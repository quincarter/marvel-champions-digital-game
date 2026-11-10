/**
 * The packs loaded right now on this thread (set by `active-packs.ts`, read by `content/pool.ts`'s `currentPool()`). A
 * module of its own with no imports beyond a type, so the pool can read it without pulling in the store or the loader.
 * The engine worker never reads it: a game carries its own packs (`SessionConfig.packs`).
 */
import type { PackRuntime } from "./pack-runtime.js";

let loaded: readonly PackRuntime[] = [];
const listeners = new Set<(packs: readonly PackRuntime[]) => void>();

/** Every loaded pack, in install order. The same array until `setLoadedPacks` replaces it. */
export function loadedPacks(): readonly PackRuntime[] {
  return loaded;
}

export function setLoadedPacks(packs: readonly PackRuntime[]): void {
  loaded = packs;
  for (const listener of [...listeners]) listener(packs);
}

/** Calls `listener` after each change; returns the unsubscribe. */
export function onLoadedPacksChange(listener: (packs: readonly PackRuntime[]) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
