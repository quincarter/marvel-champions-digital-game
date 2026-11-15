/**
 * The Title's "Looking for your old save?" banner (issue #723). The web game moved from Netlify to its own domain
 * (PR #708), and a browser keeps each address's saves apart, so a web player's games stayed at the old address. That
 * address now serves the "we have moved" page (`site/moved/`), which reads those saves, downloads them as a save file
 * and walks the player through importing it here. The banner points a player who lands at the new address first back
 * there.
 *
 * Only the web game at the new address shows it: the installed apps keep their saves inside the app, and a preview or
 * a dev server never had saves at the old address. `?oldsave=1` shows it anywhere on the web, for a screenshot or a
 * test. Closing it is remembered in `localStorage` under an `mc-*` key, as the update banner's "not now" is
 * (`update-dismissal.ts`), so the save-data export carries it.
 */
import { GAME_URL, OLD_SITE_URL } from "../site/site-urls.js";
import type { Platform } from "./platform.js";

export const OLD_SAVE_DISMISSED_KEY = "mc-old-save-notice-dismissed";

/** The moved page at the old address, where the save recovery steps are. */
export const OLD_SAVE_PAGE_URL = OLD_SITE_URL;

/** The banner's buttons: focus stops and button ids. */
export const OLD_SAVE_OPEN_ID = "old-save-open";

type PrefStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): PrefStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Whether the player closed the banner (a store that cannot be read counts as not closed). */
export function isOldSaveNoticeDismissed(storage: PrefStorage | null = browserStorage()): boolean {
  try {
    return storage?.getItem(OLD_SAVE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remembers that the player closed the banner. */
export function dismissOldSaveNotice(storage: PrefStorage | null = browserStorage()): void {
  try {
    storage?.setItem(OLD_SAVE_DISMISSED_KEY, "1");
  } catch {
    // A full or blocked store only means the banner comes back next visit.
  }
}

/** `?oldsave=1` from a query string: show the banner on any web address. */
export function forcedOldSaveNotice(search: string): boolean {
  const value = new URLSearchParams(search).get("oldsave");
  return value === "1" || value === "on";
}

/** Whether the Title offers the banner: the web game at its new address (or forced), not yet closed. */
export function wantsOldSaveNotice(input: {
  readonly platform: Platform;
  readonly host: string;
  readonly search: string;
  readonly dismissed: boolean;
}): boolean {
  if (input.platform !== "web" || input.dismissed) return false;
  return input.host === new URL(GAME_URL).host || forcedOldSaveNotice(input.search);
}

/** `wantsOldSaveNotice` for this page. */
export function oldSaveNoticeWanted(platform: Platform): boolean {
  const where = globalThis.location;
  return wantsOldSaveNotice({
    platform,
    host: where?.host ?? "",
    search: where?.search ?? "",
    dismissed: isOldSaveNoticeDismissed(),
  });
}
