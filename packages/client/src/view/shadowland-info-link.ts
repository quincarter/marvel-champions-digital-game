/**
 * Where the title screen's temporary Shadowland notice bar goes (`ui/shadowland-notice-bar.ts`): the page
 * `public/shadowland-info.html`, served at `/shadowland-info.html`. Resolved exactly as `view/sync-info-link.ts`
 * resolves the sync guide: against the page in a browser, so a deploy preview opens its own copy, and the production
 * site in the Capacitor and Tauri apps, which have no site to resolve against. `src-tauri/capabilities/default.json`
 * already lists that site for Tauri's opener.
 */

export const SHADOWLAND_INFO_PATH = "shadowland-info.html";
export const SHADOWLAND_INFO_SITE_URL = "https://marvel-champions-digital-game.netlify.app/shadowland-info.html";

/** `pageUrl` is `location.href`; `native` is `isNativeShell()`. */
export function shadowlandInfoUrl(pageUrl: string, native: boolean): string {
  if (native) return SHADOWLAND_INFO_SITE_URL;
  try {
    return new URL(SHADOWLAND_INFO_PATH, pageUrl).href;
  } catch {
    return SHADOWLAND_INFO_SITE_URL;
  }
}
