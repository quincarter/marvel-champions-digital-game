/**
 * "Is there a newer release for this install?", for the native apps.
 *
 * The desktop and Android builds are downloaded from GitHub releases, not an app store, so nothing tells a player a
 * newer one exists. This asks GitHub's public API for the repo's latest published release (drafts and prereleases
 * are never "latest", so a release still building is not offered) and offers it only when it is newer than this
 * build *and* carries an installer for the platform it is running on. Where the install can tell which installer it
 * came from (the desktop shell's `installer_kind` command, `src-tauri/src/lib.rs`), the offer links straight to that
 * file; the release page, with its notes and every download, is always the other link. The web app is redeployed on
 * every merge and never asks.
 *
 * The API sends `access-control-allow-origin: *`, so this is the webview's own `fetch` in both shells, with no native
 * HTTP scope to widen. Unauthenticated calls are limited to 60 an hour per IP; one per launch is far inside that.
 */

import { detectPlatform, type Platform } from "./platform.js";
import { CLIENT_VERSION } from "../version.js";

const REPO_URL = "https://github.com/quincarter/marvel-champions-digital-game";
const LATEST_RELEASE_API = "https://api.github.com/repos/quincarter/marvel-champions-digital-game/releases/latest";

/** The platforms a release ships installers for. iOS is absent: no release ships an iOS build. */
export type InstallOs = "android" | "windows" | "macos" | "linux";

/** One installer file of a release: what this install was itself installed from. */
export type InstallerKind = "apk" | "nsis" | "msi" | "dmg-aarch64" | "dmg-x64" | "appimage" | "deb" | "rpm";

export interface InstallTarget {
  readonly os: InstallOs;
  /** Null when the install can't tell (a Linux distro that is neither Debian- nor Red Hat-like). */
  readonly kind: InstallerKind | null;
}

export interface ReleaseAsset {
  readonly name: string;
  readonly url: string;
}

export interface LatestRelease {
  /** Without the tag's leading `v`. */
  readonly version: string;
  /** The release's page on GitHub: its notes and every download. */
  readonly url: string;
  readonly assets: readonly ReleaseAsset[];
}

export interface AvailableUpdate {
  readonly version: string;
  /** This install's own installer in the new release, or null when it isn't known or isn't there. */
  readonly downloadUrl: string | null;
  /** The release page: the changelog, and every download to pick from. */
  readonly notesUrl: string;
}

/**
 * Any installer for each platform, as the release workflow names them (release-on-merge.yml's `assetNamePattern`,
 * e.g. `MarvelChampions-0.21.0-windows-x64-setup.exe`).
 */
const OS_INSTALLERS: Record<InstallOs, RegExp> = {
  android: /\.apk$/i,
  windows: /(-setup\.exe|\.msi)$/i,
  macos: /\.dmg$/i,
  linux: /\.(AppImage|deb|rpm)$/i,
};

const KIND_INSTALLER: Record<InstallerKind, { readonly os: InstallOs; readonly file: RegExp }> = {
  apk: { os: "android", file: /\.apk$/i },
  nsis: { os: "windows", file: /-setup\.exe$/i },
  msi: { os: "windows", file: /\.msi$/i },
  // `-macos-apple-silicon.dmg` / `-macos-intel.dmg` since release asset names say their variant; Tauri's own
  // `_aarch64.dmg` / `_x64.dmg` from earlier releases still match.
  "dmg-aarch64": { os: "macos", file: /(-apple-silicon|_aarch64)\.dmg$/i },
  "dmg-x64": { os: "macos", file: /(-intel|_x64)\.dmg$/i },
  appimage: { os: "linux", file: /\.AppImage$/i },
  deb: { os: "linux", file: /\.deb$/i },
  rpm: { os: "linux", file: /\.rpm$/i },
};

export function installOs(platform: Platform, userAgent: string): InstallOs | null {
  if (platform === "capacitor") return /android/i.test(userAgent) ? "android" : null;
  if (platform !== "tauri") return null;
  if (/windows/i.test(userAgent)) return "windows";
  if (/mac os x|macintosh/i.test(userAgent)) return "macos";
  if (/linux|x11/i.test(userAgent)) return "linux";
  return null;
}

/**
 * Android has one installer. On desktop the shell reports its own (`reported`); anything it reports that isn't an
 * installer for `os` is ignored, leaving the release page as the only link.
 */
export function installTargetOf(os: InstallOs, reported: unknown): InstallTarget {
  if (os === "android") return { os, kind: "apk" };
  const kind =
    typeof reported === "string" && Object.hasOwn(KIND_INSTALLER, reported) ? (reported as InstallerKind) : null;
  return { os, kind: kind !== null && KIND_INSTALLER[kind].os === os ? kind : null };
}

/** `[major, minor, patch]` of `1.2.3` or `v1.2.3`, or null for anything else (a pre-release suffix included). */
export function parseVersion(text: string): readonly [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  return match === null ? null : [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (a === null || b === null) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]!;
  }
  return false;
}

/**
 * Reads GitHub's release JSON. Null for a draft, a prerelease, or anything malformed. Only URLs under this repo are
 * kept: they are opened outside the game, so a response is not trusted to name any other destination.
 */
export function parseLatestRelease(json: unknown): LatestRelease | null {
  if (typeof json !== "object" || json === null) return null;
  const release = json as Record<string, unknown>;
  if (release.draft === true || release.prerelease === true) return null;
  const { tag_name: tag, html_url: url } = release;
  if (typeof tag !== "string" || parseVersion(tag) === null || !isRepoUrl(url)) return null;
  const assets: ReleaseAsset[] = [];
  for (const entry of Array.isArray(release.assets) ? release.assets : []) {
    const { name, browser_download_url: download } = (entry ?? {}) as Record<string, unknown>;
    if (typeof name === "string" && isRepoUrl(download)) assets.push({ name, url: download });
  }
  return { version: tag.trim().replace(/^v/, ""), url, assets };
}

function isRepoUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(`${REPO_URL}/`);
}

/** The update to offer, or null: not newer, or published without an installer for the target's platform. */
export function updateFor(
  release: LatestRelease,
  currentVersion: string,
  target: InstallTarget,
): AvailableUpdate | null {
  if (!isNewerVersion(release.version, currentVersion)) return null;
  if (!release.assets.some((asset) => OS_INSTALLERS[target.os].test(asset.name))) return null;
  const file = target.kind === null ? null : KIND_INSTALLER[target.kind].file;
  const installer = file === null ? undefined : release.assets.find((asset) => file.test(asset.name));
  return { version: release.version, downloadUrl: installer?.url ?? null, notesUrl: release.url };
}

let answered: Promise<AvailableUpdate | null> | null = null;

/**
 * Asks once per launch and remembers the answer, so every later Title visit has it at once. Never rejects: offline,
 * rate-limited or malformed all mean "nothing to offer", and a failed ask is retried on the next call.
 */
export function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (answered !== null) return answered;
  const platform = detectPlatform();
  const os = installOs(platform, globalThis.navigator?.userAgent ?? "");
  if (os === null) return (answered = Promise.resolve(null));
  const asking = Promise.all([fetchLatestRelease(), platform === "tauri" ? reportedInstallerKind() : null]).then(
    ([release, reported]) =>
      release === null ? null : updateFor(release, CLIENT_VERSION, installTargetOf(os, reported)),
    () => {
      answered = null;
      return null;
    },
  );
  answered = asking;
  return asking;
}

async function fetchLatestRelease(): Promise<LatestRelease | null> {
  const response = await fetch(LATEST_RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  return parseLatestRelease(await response.json());
}

/** The desktop shell's own answer to "which installer am I from?"; null if it has none to give. */
async function reportedInstallerKind(): Promise<unknown> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke("installer_kind");
  } catch {
    return null;
  }
}
