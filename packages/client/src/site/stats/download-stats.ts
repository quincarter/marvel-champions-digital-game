/**
 * The download stats page's numbers (`site/landing/stats/`), worked out from GitHub's own download count for each file
 * of each release. The landing build asks GitHub for every release and runs `summarizeDownloads` over them
 * (`vite.site.config.ts`, `virtual:download-stats`), and a scheduled deploy (landing-deploy.yml) rebuilds the
 * page, so the numbers are never more than a day old.
 *
 * A download is a file fetched, not a person: one player who updates five times counts five times. Only installers
 * count (and, apart from them, the Install for Steam scripts); checksums, the mod SDK and anything else a release
 * carries don't. Playing in the browser isn't counted at all.
 */

export type Platform = "android" | "windows" | "mac" | "linux";
export const PLATFORMS: readonly Platform[] = ["android", "windows", "mac", "linux"];

/** The installer formats, each under its platform, in the order the page lists them. */
export type FileKind = "apk" | "exe" | "msi" | "dmg" | "appTarGz" | "appImage" | "deb" | "rpm";
export const FILE_KINDS: Readonly<Record<Platform, readonly FileKind[]>> = {
  android: ["apk"],
  windows: ["exe", "msi"],
  mac: ["dmg", "appTarGz"],
  linux: ["appImage", "deb", "rpm"],
};

export type SteamOs = "linux" | "windows" | "mac";
export const STEAM_OSES: readonly SteamOs[] = ["linux", "windows", "mac"];

/** What a release asset is: an installer (with its card language, if its name has one) or an Install for Steam file. */
export type AssetKind =
  | {
      readonly type: "installer";
      readonly platform: Platform;
      readonly kind: FileKind;
      readonly language: string | null;
    }
  | { readonly type: "steam"; readonly os: SteamOs };

/** A file name's ending and what it is. The macOS updater archive is checked before anything ending in .gz. */
const INSTALLERS: readonly { readonly match: RegExp; readonly platform: Platform; readonly kind: FileKind }[] = [
  { match: /\.apk$/i, platform: "android", kind: "apk" },
  { match: /\.exe$/i, platform: "windows", kind: "exe" },
  { match: /\.msi$/i, platform: "windows", kind: "msi" },
  { match: /\.dmg$/i, platform: "mac", kind: "dmg" },
  { match: /\.app\.tar\.gz$/i, platform: "mac", kind: "appTarGz" },
  { match: /\.AppImage$/i, platform: "linux", kind: "appImage" },
  { match: /\.deb$/i, platform: "linux", kind: "deb" },
  { match: /\.rpm$/i, platform: "linux", kind: "rpm" },
];

/** `MarvelChampions-<version>-<LANG>-...` (release-on-merge.yml); releases before v0.39.0 have no language. */
const LANGUAGE_OF = /^MarvelChampions-[\d.]+-([A-Z]{2})-/;
/**
 * `MarvelChampions-<OS>-Install-for-Steam.<ext>`, the Linux one also as a .tar.gz; before v0.41.0 the name carried the
 * version (`MarvelChampions-0.38.0-Windows-Install-for-Steam.ps1`).
 */
const STEAM_OF = /^MarvelChampions-(?:[\d.]+-)?(Windows|macOS|Linux)-Install-for-Steam\./;

export function classifyAsset(name: string): AssetKind | null {
  const steam = STEAM_OF.exec(name);
  if (steam) return { type: "steam", os: steam[1] === "Windows" ? "windows" : steam[1] === "macOS" ? "mac" : "linux" };
  const installer = INSTALLERS.find(({ match }) => match.test(name));
  if (!installer) return null;
  return {
    type: "installer",
    platform: installer.platform,
    kind: installer.kind,
    language: LANGUAGE_OF.exec(name)?.[1]?.toLowerCase() ?? null,
  };
}

/** What the page reads of a GitHub release (the REST API's release object, trimmed). */
export interface GitHubRelease {
  readonly tag_name: string;
  readonly name?: string | null;
  readonly draft?: boolean;
  readonly prerelease?: boolean;
  readonly published_at?: string | null;
  readonly assets: readonly { readonly name: string; readonly download_count: number }[];
}

export interface ReleaseDownloads {
  /** "v0.44.0". */
  readonly version: string;
  /** ISO time GitHub published it. */
  readonly date: string;
  readonly installers: number;
  readonly platforms: Readonly<Record<Platform, number>>;
  /** Install for Steam runs, or `null` for a release that had no script yet. */
  readonly steam: number | null;
}

export interface DownloadStats {
  /** When GitHub was asked, ISO. */
  readonly countedAt: string;
  /** The first release counted, "v0.19.0". */
  readonly since: string;
  /** Every release counted, newest first. */
  readonly releases: readonly ReleaseDownloads[];
  readonly installers: number;
  readonly platforms: Readonly<Record<Platform, number>>;
  readonly files: Readonly<Record<FileKind, number>>;
  readonly steam: { readonly total: number; readonly since: string | null } & Readonly<Record<SteamOs, number>>;
  /**
   * Installers by card language (lower-case code), from the first release with a language in its file names, or
   * `null` before any release had one.
   */
  readonly languages: { readonly since: string; readonly counts: Readonly<Record<string, number>> } | null;
  /** Installers downloaded from every release before `since`, for comparison. */
  readonly before: number;
  /** The `TOP_RELEASES` releases with the most installer downloads, most first. */
  readonly top: readonly ReleaseDownloads[];
}

export const TOP_RELEASES = 5;

/** "v0.19.1" → [0, 19, 1]; anything that isn't a version sorts first. */
function versionParts(tag: string): readonly number[] {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(tag);
  return match ? match.slice(1).map(Number) : [-1, -1, -1];
}

export function compareVersions(a: string, b: string): number {
  const [x, y] = [versionParts(a), versionParts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return 0;
}

const zeroPlatforms = (): Record<Platform, number> => ({ android: 0, windows: 0, mac: 0, linux: 0 });

/**
 * The stats for every published release from `since` on. Drafts and pre-releases are left out, as is anything that
 * isn't a version tag.
 */
export function summarizeDownloads(
  releases: readonly GitHubRelease[],
  since: string,
  countedAt: string,
): DownloadStats {
  const published = releases
    .filter((release) => !release.draft && !release.prerelease && /^v\d+\.\d+\.\d+$/.test(release.tag_name))
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name));

  const platforms = zeroPlatforms();
  const files = Object.fromEntries(
    Object.values(FILE_KINDS)
      .flat()
      .map((kind) => [kind, 0]),
  ) as Record<FileKind, number>;
  const steam: Record<SteamOs, number> = { linux: 0, windows: 0, mac: 0 };
  let steamSince: string | null = null;
  const languageCounts: Record<string, number> = {};
  let languageSince: string | null = null;
  let before = 0;
  const counted: ReleaseDownloads[] = [];

  for (const release of published) {
    const kinds = release.assets.map((asset) => ({ asset, kind: classifyAsset(asset.name) }));
    const installers = kinds.flatMap(({ asset, kind }) =>
      kind?.type === "installer" ? [{ count: asset.download_count, kind }] : [],
    );
    const total = installers.reduce((sum, { count }) => sum + count, 0);
    if (compareVersions(release.tag_name, since) < 0) {
      before += total;
      continue;
    }
    const own = zeroPlatforms();
    for (const { count, kind } of installers) {
      own[kind.platform] += count;
      files[kind.kind] += count;
    }
    for (const platform of PLATFORMS) platforms[platform] += own[platform];

    const steamFiles = kinds.flatMap(({ asset, kind }) =>
      kind?.type === "steam" ? [{ count: asset.download_count, os: kind.os }] : [],
    );
    for (const { count, os } of steamFiles) steam[os] += count;
    // Newest first, so the last one seen is the oldest.
    if (steamFiles.length > 0) steamSince = release.tag_name;

    const withLanguage = installers.filter(({ kind }) => kind.language !== null);
    if (withLanguage.length > 0) {
      languageSince = release.tag_name;
      for (const { count, kind } of withLanguage)
        languageCounts[kind.language!] = (languageCounts[kind.language!] ?? 0) + count;
    }

    counted.push({
      version: release.tag_name,
      date: release.published_at ?? "",
      installers: total,
      platforms: own,
      steam: steamFiles.length > 0 ? steamFiles.reduce((sum, { count }) => sum + count, 0) : null,
    });
  }

  const installers = PLATFORMS.reduce((sum, platform) => sum + platforms[platform], 0);
  // Ties go to the older release, which had to earn its count before the newer one shipped.
  const top = [...counted]
    .sort((a, b) => b.installers - a.installers || compareVersions(a.version, b.version))
    .slice(0, TOP_RELEASES);
  return {
    countedAt,
    since,
    releases: counted,
    installers,
    platforms,
    files,
    steam: { total: steam.linux + steam.windows + steam.mac, since: steamSince, ...steam },
    languages: languageSince === null ? null : { since: languageSince, counts: languageCounts },
    before,
    top,
  };
}

/** The share of `part` in `whole` as a whole percentage, 0 for an empty whole. */
export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

/** The first release the stats page counts: the first one built by the release workflow the game ships with now. */
export const STATS_SINCE = "v0.19.0";

/** Where the landing build publishes the stats it counted, so a later run can tell whether anything has changed. */
export const STATS_JSON_PATH = "stats/downloads.json";

/**
 * Whether two counts say the same thing, whenever they were counted. The scheduled deploy (landing-deploy.yml) skips
 * the rebuild when GitHub's numbers match the live page's.
 */
export function sameCounts(a: DownloadStats, b: DownloadStats): boolean {
  const { countedAt: _a, ...left } = a;
  const { countedAt: _b, ...right } = b;
  return JSON.stringify(left) === JSON.stringify(right);
}
