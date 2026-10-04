/**
 * The one remembered choice on the seat screens: whether the "Recommended" shelf is collapsed. Kept in
 * `localStorage` the way the guide prefs are (a bare string, read once per visit), with the storage passed in so the
 * rules are tested without a browser. Null means "never chosen": the screen then opens the shelf.
 */
export const REC_COLLAPSED_KEY = "mc-seats-recommended-collapsed";

type PrefStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): PrefStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function loadRecommendedCollapsed(storage: PrefStorage | null = browserStorage()): boolean | null {
  try {
    const raw = storage?.getItem(REC_COLLAPSED_KEY);
    return raw === "1" ? true : raw === "0" ? false : null;
  } catch {
    return null;
  }
}

export function saveRecommendedCollapsed(collapsed: boolean, storage: PrefStorage | null = browserStorage()): void {
  try {
    storage?.setItem(REC_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // A full or blocked store only means the choice is not remembered.
  }
}
