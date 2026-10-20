/**
 * The achievements the "Achievement unlocked" popup has already announced (`scenes/achievement-toast.ts`): kept in
 * `localStorage` under an `mc-*` key, so the save-data export carries it with the saves it was earned from, and with
 * the storage passed in so the rule is tested without a browser.
 */
export const ACHIEVEMENTS_SEEN_KEY = "mc-achievements-seen";

type PrefStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): PrefStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/**
 * The ids already announced, or null when none were ever stored: a first run (or a store that cannot be read, or holds
 * nonsense), whose achievements are recorded without a popup.
 */
export function achievementsSeen(storage: PrefStorage | null = browserStorage()): ReadonlySet<string> | null {
  try {
    const raw = storage?.getItem(ACHIEVEMENTS_SEEN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return null;
  }
}

export function rememberAchievementsSeen(ids: Iterable<string>, storage: PrefStorage | null = browserStorage()): void {
  try {
    storage?.setItem(ACHIEVEMENTS_SEEN_KEY, JSON.stringify([...ids].sort()));
  } catch {
    // A full or blocked store only means a popup may show again next launch.
  }
}
