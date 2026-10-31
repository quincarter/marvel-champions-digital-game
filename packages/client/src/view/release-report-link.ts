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

/**
 * `pageUrl` is `location.href`; `native` is `isNativeShell()`. A release other than the one this build has a report
 * for (`view/release-notice.ts`, following GitHub) opens in the release history, which draws any release.
 */
export function releaseReportUrl(pageUrl: string, native: boolean, version = RELEASE_NOTICE_VERSION): string {
  if (version !== RELEASE_NOTICE_VERSION) return releaseHistoryUrl(version.replace(/^v/, ""), pageUrl, native);
  if (native) return RELEASE_REPORT_SITE_URL;
  try {
    return new URL(RELEASE_REPORT_PATH, pageUrl).href;
  } catch {
    return RELEASE_REPORT_SITE_URL;
  }
}

/**
 * The release history page (`public/releases/index.html`), open at one release: where the Title footer's "Release
 * notes" goes. Resolved the same way as the report above.
 */
export function releaseHistoryUrl(version: string, pageUrl: string, native: boolean): string {
  const path = `releases/index.html#v${version}`;
  if (native) return `${SITE_URL}${path}`;
  try {
    return new URL(path, pageUrl).href;
  } catch {
    return `${SITE_URL}${path}`;
  }
}
