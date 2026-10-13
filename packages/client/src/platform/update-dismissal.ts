/**
 * The update banner's "not now": the release version a player dismissed, kept in `localStorage` under an `mc-*` key
 * (so the save-data export carries it, as it does every other remembered choice) with the storage passed in so the
 * rule is tested without a browser. A dismissal is for one release: a newer one is a different version and shows the
 * banner again.
 */
export const UPDATE_DISMISSED_KEY = "mc-update-dismissed";

type PrefStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): PrefStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** The version last dismissed, or null when none was (or the store cannot be read). */
export function dismissedUpdateVersion(storage: PrefStorage | null = browserStorage()): string | null {
  try {
    const raw = storage?.getItem(UPDATE_DISMISSED_KEY);
    return raw ? raw : null;
  } catch {
    return null;
  }
}

/** Remembers that the player dismissed the banner for `version`. */
export function dismissUpdate(version: string, storage: PrefStorage | null = browserStorage()): void {
  try {
    storage?.setItem(UPDATE_DISMISSED_KEY, version);
  } catch {
    // A full or blocked store only means the dismissal is not remembered.
  }
}

/** Whether the banner for `version` is hidden: only the exact release the player dismissed. */
export function isUpdateDismissed(version: string, dismissed: string | null): boolean {
  return dismissed !== null && dismissed === version;
}
