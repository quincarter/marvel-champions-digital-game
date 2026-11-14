/**
 * The download buttons on the moved page and the landing page: which installer suits the visitor's device, and every
 * other one, from GitHub's latest published release (the in-app update check reads the same release,
 * `platform/update-check.ts`).
 *
 * Release assets are named `MarvelChampions-<version>-<LANG>-<platform...>.<ext>` (release-on-merge.yml), one set per
 * card language, plus the language-free "Install for Steam" scripts. A native build carries one card language, so the
 * page offers the visitor's language first.
 */
import type { PageLanguage } from "./page-language.js";

export type DeviceKind = "windows" | "mac" | "linux" | "android" | "ios" | "other";

export interface DeviceHints {
  readonly userAgent: string;
  /** `navigator.userAgentData.platform` where the browser has it ("Windows", "macOS", "Android", "Linux"). */
  readonly uaPlatform?: string | undefined;
  /** `navigator.maxTouchPoints`: an iPad in desktop mode says "Macintosh" but has touch points. */
  readonly maxTouchPoints?: number | undefined;
}

export function detectDevice({ userAgent, uaPlatform = "", maxTouchPoints = 0 }: DeviceHints): DeviceKind {
  const platform = uaPlatform.toLowerCase();
  const ua = userAgent.toLowerCase();
  if (platform === "android" || ua.includes("android")) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (platform === "macos" || ua.includes("macintosh") || ua.includes("mac os x")) {
    return maxTouchPoints > 1 ? "ios" : "mac";
  }
  if (platform === "windows" || ua.includes("windows")) return "windows";
  if (platform === "linux" || platform === "chrome os" || ua.includes("linux") || ua.includes("cros")) return "linux";
  return "other";
}

export function browserDevice(): DeviceKind {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return detectDevice({
    userAgent: nav.userAgent,
    uaPlatform: nav.userAgentData?.platform,
    maxTouchPoints: nav.maxTouchPoints,
  });
}

/** One installer the pages offer. `id` keys its label in each page's text. */
export type DownloadId =
  | "windows-setup"
  | "windows-msi"
  | "mac-arm"
  | "mac-intel"
  | "linux-appimage"
  | "linux-deb"
  | "linux-rpm"
  | "android-apk"
  | "steam-windows"
  | "steam-mac"
  | "steam-linux";

export interface Download {
  readonly id: DownloadId;
  readonly device: Exclude<DeviceKind, "ios" | "other">;
  readonly url: string;
  readonly fileName: string;
  /** The card language the build carries, or `null` for the language-free Steam scripts. */
  readonly language: string | null;
}

export interface ReleaseAsset {
  readonly name: string;
  readonly browser_download_url: string;
}

export interface LatestRelease {
  readonly tag_name: string;
  readonly html_url: string;
  readonly published_at?: string;
  readonly assets: readonly ReleaseAsset[];
}

/** Each installer's file name ending, after `MarvelChampions-<version>-<LANG>-`, or the whole name for Steam. */
const PATTERNS: readonly { readonly id: DownloadId; readonly device: Download["device"]; readonly match: RegExp }[] = [
  { id: "windows-setup", device: "windows", match: /-Windows-x64-Setup\.exe$/ },
  { id: "windows-msi", device: "windows", match: /-Windows-x64-AllUsers\.msi$/ },
  { id: "mac-arm", device: "mac", match: /-macOS-AppleSilicon-arm64\.dmg$/ },
  { id: "mac-intel", device: "mac", match: /-macOS-Intel-x64\.dmg$/ },
  { id: "linux-appimage", device: "linux", match: /-Linux-x64\.AppImage$/ },
  { id: "linux-deb", device: "linux", match: /-Linux-x64\.deb$/ },
  { id: "linux-rpm", device: "linux", match: /-Linux-x64\.rpm$/ },
  { id: "android-apk", device: "android", match: /-Android\.apk$/ },
  { id: "steam-windows", device: "windows", match: /^MarvelChampions-Windows-Install-for-Steam\.cmd$/ },
  { id: "steam-mac", device: "mac", match: /^MarvelChampions-macOS-Install-for-Steam\.sh$/ },
  { id: "steam-linux", device: "linux", match: /^MarvelChampions-Linux-Install-for-Steam\.sh$/ },
];

const LANGUAGE_OF = /^MarvelChampions-[\d.]+-([A-Z]{2})-/;

/**
 * Every installer in `release`, one per id: the one built in `language` where the release has it, else English, else
 * whichever language it has. In `PATTERNS` order, so a device's main installer comes first.
 */
export function downloadsOf(release: LatestRelease, language: PageLanguage): Download[] {
  const wanted = [language.toUpperCase(), "EN"];
  const downloads: Download[] = [];
  for (const { id, device, match } of PATTERNS) {
    const candidates = release.assets
      .filter((asset) => match.test(asset.name))
      .map((asset) => ({ asset, language: LANGUAGE_OF.exec(asset.name)?.[1] ?? null }));
    if (candidates.length === 0) continue;
    const rank = (lang: string | null): number => {
      const at = lang === null ? -1 : wanted.indexOf(lang);
      return at === -1 ? wanted.length : at;
    };
    const best = [...candidates].sort((a, b) => rank(a.language) - rank(b.language))[0]!;
    downloads.push({
      id,
      device,
      url: best.asset.browser_download_url,
      fileName: best.asset.name,
      language: best.language,
    });
  }
  return downloads;
}

/** The download to put on the big button for `device`: its first installer, or none for a phone without one. */
export function primaryDownload(downloads: readonly Download[], device: DeviceKind): Download | undefined {
  return downloads.find((download) => download.device === device && !download.id.startsWith("steam-"));
}

/** "v0.44.0" → "0.44.0". */
export function versionOf(release: LatestRelease): string {
  return release.tag_name.replace(/^v/, "");
}

/** GitHub's latest release, or `null` when GitHub is out of reach or slow (the pages then link the releases page). */
export async function fetchLatestRelease(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 6000,
): Promise<LatestRelease | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<LatestRelease>;
    if (typeof data.tag_name !== "string" || !Array.isArray(data.assets)) return null;
    return data as LatestRelease;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
