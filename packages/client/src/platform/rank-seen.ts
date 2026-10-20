/**
 * The highest rank the Title has shown (docs/achievements.md): kept in `localStorage` under an `mc-*` key, so the
 * save-data export carries it, with the storage passed in so the rule is tested without a browser. It only decides
 * whether the next Title visit plays the rank-up fanfare (`view/title-rank-badge.ts`).
 */
export const RANK_SEEN_KEY = "mc-rank-seen";

type PrefStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): PrefStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** The rank last shown, or null when none was stored (or the store cannot be read, or holds nonsense). */
export function lastRankSeen(storage: PrefStorage | null = browserStorage()): number | null {
  try {
    const raw = storage?.getItem(RANK_SEEN_KEY);
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isInteger(n) && n >= 1 ? n : null;
  } catch {
    return null;
  }
}

export function rememberRankSeen(rank: number, storage: PrefStorage | null = browserStorage()): void {
  try {
    storage?.setItem(RANK_SEEN_KEY, String(rank));
  } catch {
    // A full or blocked store only means the fanfare may play again.
  }
}
