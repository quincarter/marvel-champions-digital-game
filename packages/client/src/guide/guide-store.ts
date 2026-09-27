/**
 * The app's one live `GuidePrefs` value (docs/guided-mode.md §4 G2b): loaded once from `localStorage` the same way
 * `progression/progression.ts` exposes its own `unlocks()` singleton, written back on every change, and broadcast
 * to whoever is drawing a guide control right now.
 *
 * `guide-prefs.ts` stays pure data plus pure helpers (`withLevel`, `silenceWarning`, …) with no notion of "the
 * current one" — this module is the thin wiring layer over it, so a scene never has to read/parse/write
 * `localStorage` itself, the same division `unlocks.ts`/`progression.ts` already draw.
 */
import { loadGuidePrefs, saveGuidePrefs, type GuidePrefs } from "./guide-prefs.js";

let current: GuidePrefs | null = null;
const listeners = new Set<(prefs: GuidePrefs) => void>();

/** The current guide prefs, read from `localStorage` once and cached after that. */
export function guidePrefs(): GuidePrefs {
  current ??= loadGuidePrefs();
  return current;
}

/** Replaces the current guide prefs, persists them, and notifies every listener (`onGuidePrefsChange`). */
export function setGuidePrefs(next: GuidePrefs): void {
  current = next;
  saveGuidePrefs(next);
  for (const listener of listeners) listener(next);
}

/** Subscribes to every future `setGuidePrefs` call. Returns an unsubscribe function. */
export function onGuidePrefsChange(listener: (prefs: GuidePrefs) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only: drops the cached value so the next `guidePrefs()` re-reads `localStorage`. */
export function resetGuidePrefsCacheForTests(): void {
  current = null;
}
