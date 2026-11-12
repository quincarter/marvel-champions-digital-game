/**
 * Whether the player has seen the Mod Store's heads-up (`view/mod-notice.ts`): kept in `localStorage` under an `mc-*`
 * key, with the storage passed in so the rule is tested without a browser. A blocked or full store only means the
 * notice may show again.
 */
export const MOD_NOTICE_SEEN_KEY = "mc-mod-notice-seen";

type PrefStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): PrefStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function modNoticeSeen(storage: PrefStorage | null = browserStorage()): boolean {
  try {
    return storage?.getItem(MOD_NOTICE_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberModNoticeSeen(storage: PrefStorage | null = browserStorage()): void {
  try {
    storage?.setItem(MOD_NOTICE_SEEN_KEY, "1");
  } catch {
    // Nothing to do: the notice shows again next time.
  }
}
