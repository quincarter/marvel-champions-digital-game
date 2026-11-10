/**
 * How the Saga lists its volumes between visits, on a phone or an upright tablet: box art tiles, or plain rows. Kept in
 * `localStorage` (an `mc-*` entry, so a save file carries it), with the storage passed in so the rule is tested
 * without a browser. Anything unreadable, or no choice yet, falls back to the screen's default.
 */
export const SAGA_VIEW_KEY = "mc-saga-view";

export type SagaVolumesView = "grid" | "list";

type PrefStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): PrefStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function sagaVolumesView(
  fallback: SagaVolumesView,
  storage: PrefStorage | null = browserStorage(),
): SagaVolumesView {
  try {
    const kept = storage?.getItem(SAGA_VIEW_KEY);
    return kept === "grid" || kept === "list" ? kept : fallback;
  } catch {
    return fallback;
  }
}

export function rememberSagaVolumesView(view: SagaVolumesView, storage: PrefStorage | null = browserStorage()): void {
  try {
    storage?.setItem(SAGA_VIEW_KEY, view);
  } catch {
    // Private mode or a full store: the view just isn't kept.
  }
}
