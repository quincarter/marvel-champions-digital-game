/**
 * A tiny signal that lives in the entry chunk so screens can listen for "a sync brought in saves from another device"
 * without importing the sync code itself (which loads after the first paint, `main.ts`).
 */
const listeners = new Set<() => void>();

export function onSyncApplied(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSyncApplied(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A screen's redraw failing must not stop the others.
    }
  }
}
