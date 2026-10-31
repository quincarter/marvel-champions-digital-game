/**
 * Where the title screen's release notice bar goes (`ui/release-notice-bar.ts`): the release report at
 * `public/releases/<version>/index.html`, served at the same path. Resolved exactly as `view/sync-info-link.ts` resolves
 * the sync guide: against the page in a browser, so a deploy preview opens its own copy, and the production site in the
 * Capacitor and Tauri apps, which have no site to resolve against. `src-tauri/capabilities/default.json` already lists
 * that site for Tauri's opener.
 */

import { RELEASE_NOTICE_VERSION } from "./release-notice.js";

const SITE_URL = "https://marvel-champions-digital-game.netlify.app/";

export const RELEASE_REPORT_PATH = `releases/${RELEASE_NOTICE_VERSION}/index.html`;
export const RELEASE_REPORT_SITE_URL = `${SITE_URL}${RELEASE_REPORT_PATH}`;

/** `pageUrl` is `location.href`; `native` is `isNativeShell()`. */
export function releaseReportUrl(pageUrl: string, native: boolean): string {
  if (native) return RELEASE_REPORT_SITE_URL;
  try {
    return new URL(RELEASE_REPORT_PATH, pageUrl).href;
  } catch {
    return RELEASE_REPORT_SITE_URL;
  }
}
