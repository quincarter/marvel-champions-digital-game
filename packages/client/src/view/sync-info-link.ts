/**
 * Where the "More information" control on device sync's screens goes (#276): the player guide `public/sync-info.html`,
 * served at `/sync-info.html`. In a browser it is resolved against the page, so a deploy preview opens its own copy; in
 * the Capacitor and Tauri apps there is no site to resolve against (the page is a local origin), so it is the
 * production site. `src-tauri/capabilities/default.json` lists that site for Tauri's opener.
 */

export const SYNC_INFO_PATH = "sync-info.html";
export const SYNC_INFO_SITE_URL = "https://marvel-champions-digital-game.netlify.app/sync-info.html";
export const SYNC_INFO_LABEL = "More information ↗";

/** `pageUrl` is `location.href`; `native` is `isNativeShell()`. */
export function syncInfoUrl(pageUrl: string, native: boolean): string {
  if (native) return SYNC_INFO_SITE_URL;
  try {
    return new URL(SYNC_INFO_PATH, pageUrl).href;
  } catch {
    return SYNC_INFO_SITE_URL;
  }
}
