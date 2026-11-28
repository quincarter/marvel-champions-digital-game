/**
 * Opens the release report the Title's notice bar (`mc-title-notice-bar`, `view/release-notice.ts`) points at, outside
 * the game.
 */
import { artLanguageNow } from "../art/art-source.js";
import { isNativeShell, openExternal } from "../platform/platform.js";
import { releaseReportUrl } from "../view/release-report-link.js";
import { RELEASE_NOTICE_VERSION } from "../view/release-notice.js";

/** Opens the release's report, exactly as the sync screens open their guide. */
export function openReleaseReport(version = RELEASE_NOTICE_VERSION): void {
  openExternal(releaseReportUrl(globalThis.location?.href ?? "", isNativeShell(), version, artLanguageNow()));
}
