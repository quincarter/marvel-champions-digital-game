/**
 * The Title footer's version stamp: which build of the client the player is actually running.
 *
 * A native app (Tauri desktop, Capacitor mobile) is built from a release tag, so it is exactly the release it's
 * stamped with. The web app is rebuilt by Netlify on every push to `main`, and a merged change reaches it long before
 * the release PR that names it — so on the web the release version alone would under-state it. There, the build's
 * commit rides along as semver build metadata: `v0.7.0+a1b2c3d` is "0.7.0, plus whatever landed up to a1b2c3d".
 */
import type { Platform } from "../platform/platform.js";

export function appVersionText(version: string, platform: Platform, commit: string): string {
  return platform === "web" && commit !== "" ? `v${version}+${commit}` : `v${version}`;
}

/** The short commit this bundle was built from, or "" (a test run, or a build with no git to ask). */
export function buildCommit(): string {
  return typeof __BUILD_COMMIT__ === "string" ? __BUILD_COMMIT__ : "";
}

/** The GitHub release page for `version`: what the footer's "Release notes" link opens. */
export const releaseNotesUrl = (version: string): string =>
  `https://github.com/quincarter/marvel-champions-digital-game/releases/tag/v${version}`;

/** One button of the Title's update banner. */
export interface UpdateAction {
  /** Also its focus stop on the Title menu. */
  readonly id: "update-notes" | "update-download";
  readonly label: string;
  readonly url: string;
}

/** The banner's close button: a focus stop and a button id, not a link (it hides the banner for that release). */
export const UPDATE_DISMISS_ID = "update-dismiss";

/**
 * What the update banner offers (`platform/update-check.ts`): the changelog and this install's own installer. When
 * the installer isn't known, one button to the release page, which has both.
 */
export function updateActions(update: {
  readonly downloadUrl: string | null;
  readonly notesUrl: string;
}): readonly UpdateAction[] {
  if (update.downloadUrl === null) return [{ id: "update-notes", label: "View release ↗", url: update.notesUrl }];
  return [
    { id: "update-notes", label: "What's new ↗", url: update.notesUrl },
    { id: "update-download", label: "Download ↗", url: update.downloadUrl },
  ];
}
