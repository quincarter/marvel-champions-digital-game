/**
 * Where the title screen's release notice bar goes (`ui/release-notice-bar.ts`): the release report at
 * `public/releases/<version>/index.html`, served at the same path. Resolved exactly as `view/sync-info-link.ts` resolves
 * the sync guide: against the page in a browser, so a deploy preview opens its own copy, and the production site in the
 * Capacitor and Tauri apps, which have no site to resolve against. `src-tauri/capabilities/default.json` already lists
 * that site for Tauri's opener.
 */

import type { CardLanguage } from "../art/card-language.js";
import { RELEASE_NOTICE_VERSION } from "./release-notice.js";

const SITE_URL = "https://marvel-champions-digital-game.netlify.app/";

export const RELEASE_REPORT_PATH = `releases/${RELEASE_NOTICE_VERSION}/index.html`;
export const RELEASE_REPORT_SITE_URL = `${SITE_URL}${RELEASE_REPORT_PATH}`;
/** Every report from v0.39.0 on has a Spanish page beside it. */
const SPANISH_REPORT_PATH = `releases/${RELEASE_NOTICE_VERSION}/index.es.html`;

/**
 * `pageUrl` is `location.href`; `native` is `isNativeShell()`. A release other than the one this build has a report
 * for (`view/release-notice.ts`, following GitHub) opens in the release history, which draws any release. `language`
 * is the player's card language, which the report opens in.
 */
export function releaseReportUrl(
  pageUrl: string,
  native: boolean,
  version = RELEASE_NOTICE_VERSION,
  language: CardLanguage = "en",
): string {
  if (version !== RELEASE_NOTICE_VERSION)
    return releaseHistoryUrl(version.replace(/^v/, ""), pageUrl, native, language);
  const path = language === "es" ? SPANISH_REPORT_PATH : RELEASE_REPORT_PATH;
  if (native) return `${SITE_URL}${path}`;
  try {
    return new URL(path, pageUrl).href;
  } catch {
    return `${SITE_URL}${path}`;
  }
}

/**
 * The release history page (`public/releases/index.html`), open at one release: where a release with no report here
 * goes. Resolved the same way as the report above. `?lang=` carries the language, because a native app opens the page
 * in a browser that knows nothing of the app.
 */
export function releaseHistoryUrl(
  version: string,
  pageUrl: string,
  native: boolean,
  language: CardLanguage = "en",
): string {
  const path = `releases/index.html?lang=${language}#v${version}`;
  if (native) return `${SITE_URL}${path}`;
  try {
    return new URL(path, pageUrl).href;
  } catch {
    return `${SITE_URL}${path}`;
  }
}

/**
 * Where the Title footer's "Release notes" goes. A packaged app opens its own release. The web build can be ahead of
 * the latest published release, whose notes aren't public yet, so it opens the history at its latest.
 */
export function releaseNotesPageUrl(
  version: string,
  pageUrl: string,
  native: boolean,
  language: CardLanguage = "en",
): string {
  return native
    ? releaseHistoryUrl(version, pageUrl, native, language)
    : releaseHistoryUrl(version, pageUrl, false, language).split("#")[0]!;
}
