import { describe, expect, it } from "vitest";
import {
  installOs,
  installTargetOf,
  isNewerVersion,
  parseLatestRelease,
  parseVersion,
  updateFor,
  type InstallOs,
  type InstallerKind,
  type LatestRelease,
} from "./update-check.js";

const REPO = "https://github.com/quincarter/marvel-champions-digital-game";
const download = (name: string) => ({ name, browser_download_url: `${REPO}/releases/download/v0.20.0/${name}` });

/** The asset names release-on-merge.yml publishes (scripts/lib/release-collector.mjs). */
const DOWNLOADS = {
  apk: "MarvelChampions-0.20.0-Android.apk",
  nsis: "MarvelChampions-0.20.0-Windows-x64-Setup.exe",
  msi: "MarvelChampions-0.20.0-Windows-x64-AllUsers.msi",
  "dmg-aarch64": "MarvelChampions-0.20.0-macOS-AppleSilicon-arm64.dmg",
  "dmg-x64": "MarvelChampions-0.20.0-macOS-Intel-x64.dmg",
  appimage: "MarvelChampions-0.20.0-Linux-x64.AppImage",
  deb: "MarvelChampions-0.20.0-Linux-x64.deb",
  rpm: "MarvelChampions-0.20.0-Linux-x64.rpm",
} as const satisfies Record<InstallerKind, string>;

const ALL_ASSETS = [
  ...Object.values(DOWNLOADS),
  "MarvelChampions-0.20.0-macOS-AppleSilicon-arm64.app.tar.gz",
  "MarvelChampions-0.20.0-macOS-Intel-x64.app.tar.gz",
  "SHA256SUMS.txt",
];

/** Tauri's own names, which releases up to v0.20.0 published. */
const LEGACY_DOWNLOADS = {
  apk: "marvel-champions-0.20.0.apk",
  nsis: "Marvel.Champions_0.20.0_x64-setup.exe",
  msi: "Marvel.Champions_0.20.0_x64_en-US.msi",
  "dmg-aarch64": "Marvel.Champions_0.20.0_aarch64.dmg",
  "dmg-x64": "Marvel.Champions_0.20.0_x64.dmg",
  appimage: "Marvel.Champions_0.20.0_amd64.AppImage",
  deb: "Marvel.Champions_0.20.0_amd64.deb",
  rpm: "Marvel.Champions-0.20.0-1.x86_64.rpm",
} as const satisfies Record<InstallerKind, string>;

const githubJson = (assets: readonly string[], extra: object = {}) => ({
  tag_name: "v0.20.0",
  html_url: `${REPO}/releases/tag/v0.20.0`,
  draft: false,
  prerelease: false,
  assets: assets.map(download),
  ...extra,
});

const release = (assets: readonly string[]): LatestRelease => parseLatestRelease(githubJson(assets))!;

describe("installOs", () => {
  const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/141.0";
  const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
  const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15";
  const ANDROID = "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile";
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15";

  it("names the desktop OS under Tauri and Android under Capacitor", () => {
    expect(installOs("tauri", WINDOWS)).toBe("windows");
    expect(installOs("tauri", MAC)).toBe("macos");
    expect(installOs("tauri", LINUX)).toBe("linux");
    expect(installOs("capacitor", ANDROID)).toBe("android");
  });

  it("is null on the web and on iOS, which no release ships a build for", () => {
    expect(installOs("web", WINDOWS)).toBeNull();
    expect(installOs("web", ANDROID)).toBeNull();
    expect(installOs("capacitor", IPHONE)).toBeNull();
  });
});

describe("version comparison", () => {
  it("parses a plain or v-prefixed version and nothing else", () => {
    expect(parseVersion("v0.19.1")).toEqual([0, 19, 1]);
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("v1.2.3-beta.1")).toBeNull();
    expect(parseVersion("latest")).toBeNull();
  });

  it("compares numerically, not as text", () => {
    expect(isNewerVersion("0.20.0", "0.19.1")).toBe(true);
    expect(isNewerVersion("0.19.10", "0.19.9")).toBe(true);
    expect(isNewerVersion("1.0.0", "0.99.99")).toBe(true);
    expect(isNewerVersion("0.19.1", "0.19.1")).toBe(false);
    expect(isNewerVersion("0.19.0", "0.19.1")).toBe(false);
    expect(isNewerVersion("nonsense", "0.19.1")).toBe(false);
  });
});

describe("parseLatestRelease", () => {
  it("reads the version, page and assets", () => {
    const parsed = parseLatestRelease(githubJson(["MarvelChampions-0.20.0-Android.apk"]));
    expect(parsed).toEqual({
      version: "0.20.0",
      url: `${REPO}/releases/tag/v0.20.0`,
      assets: [
        {
          name: "MarvelChampions-0.20.0-Android.apk",
          url: `${REPO}/releases/download/v0.20.0/MarvelChampions-0.20.0-Android.apk`,
        },
      ],
    });
  });

  it("refuses a draft, a prerelease and malformed JSON", () => {
    expect(parseLatestRelease(githubJson(ALL_ASSETS, { draft: true }))).toBeNull();
    expect(parseLatestRelease(githubJson(ALL_ASSETS, { prerelease: true }))).toBeNull();
    expect(parseLatestRelease(githubJson(ALL_ASSETS, { tag_name: "nightly" }))).toBeNull();
    expect(parseLatestRelease({ message: "API rate limit exceeded" })).toBeNull();
    expect(parseLatestRelease(null)).toBeNull();
  });

  it("keeps only URLs under this repo", () => {
    expect(parseLatestRelease(githubJson(ALL_ASSETS, { html_url: "https://example.com/releases" }))).toBeNull();
    const parsed = parseLatestRelease(
      githubJson([], { assets: [{ name: "evil.apk", browser_download_url: "https://example.com/evil.apk" }] }),
    );
    expect(parsed?.assets).toEqual([]);
  });
});

describe("installTargetOf", () => {
  it("is always the APK on Android", () => {
    expect(installTargetOf("android", null)).toEqual({ os: "android", kind: "apk" });
  });

  it("takes the desktop shell's own installer", () => {
    expect(installTargetOf("windows", "msi")).toEqual({ os: "windows", kind: "msi" });
    expect(installTargetOf("macos", "dmg-aarch64")).toEqual({ os: "macos", kind: "dmg-aarch64" });
    expect(installTargetOf("linux", "appimage")).toEqual({ os: "linux", kind: "appimage" });
  });

  it("ignores an answer that is unknown, empty or for another platform", () => {
    expect(installTargetOf("linux", "")).toEqual({ os: "linux", kind: null });
    expect(installTargetOf("linux", null)).toEqual({ os: "linux", kind: null });
    expect(installTargetOf("windows", "toString")).toEqual({ os: "windows", kind: null });
    expect(installTargetOf("windows", "deb")).toEqual({ os: "windows", kind: null });
  });
});

describe("updateFor", () => {
  const page = `${REPO}/releases/tag/v0.20.0`;
  const file = (name: string): string => `${REPO}/releases/download/v0.20.0/${name}`;

  it("offers nothing when the release is not newer", () => {
    expect(updateFor(release(ALL_ASSETS), "0.20.0", { os: "windows", kind: "nsis" })).toBeNull();
    expect(updateFor(release(ALL_ASSETS), "0.21.0", { os: "android", kind: "apk" })).toBeNull();
  });

  const osOf = { apk: "android", nsis: "windows", msi: "windows", appimage: "linux", deb: "linux", rpm: "linux" };
  for (const [naming, downloads] of [
    ["OS- and architecture-named", DOWNLOADS],
    ["Tauri-named", LEGACY_DOWNLOADS],
  ] as const) {
    it(`links the changelog and the installer this install came from (${naming} assets)`, () => {
      const assets = [...Object.values(downloads), "SHA256SUMS.txt"];
      for (const [kind, name] of Object.entries(downloads) as [InstallerKind, string][]) {
        const os = (osOf as Record<string, InstallOs>)[kind] ?? "macos";
        expect(updateFor(release(assets), "0.19.1", { os, kind })).toEqual({
          version: "0.20.0",
          downloadUrl: file(name),
          notesUrl: page,
        });
      }
    });
  }

  it("links only the release page when the installer isn't known", () => {
    expect(updateFor(release(ALL_ASSETS), "0.19.1", { os: "linux", kind: null })).toEqual({
      version: "0.20.0",
      downloadUrl: null,
      notesUrl: page,
    });
  });

  it("offers nothing to a platform the release has no installer for", () => {
    const desktopOnly = release(ALL_ASSETS.filter((name) => !name.endsWith(".apk")));
    expect(updateFor(desktopOnly, "0.19.1", { os: "android", kind: "apk" })).toBeNull();
    expect(updateFor(desktopOnly, "0.19.1", { os: "windows", kind: "nsis" })).not.toBeNull();

    const androidOnly = release([DOWNLOADS.apk, "SHA256SUMS.txt"]);
    expect(updateFor(androidOnly, "0.19.1", { os: "android", kind: "apk" })).not.toBeNull();
    expect(updateFor(androidOnly, "0.19.1", { os: "windows", kind: "msi" })).toBeNull();
    expect(updateFor(androidOnly, "0.19.1", { os: "macos", kind: "dmg-x64" })).toBeNull();
    expect(updateFor(androidOnly, "0.19.1", { os: "linux", kind: null })).toBeNull();
  });

  it("falls back to the release page when the platform has installers but not this install's own", () => {
    const msiOnly = release([DOWNLOADS.msi]);
    expect(updateFor(msiOnly, "0.19.1", { os: "windows", kind: "nsis" })).toEqual({
      version: "0.20.0",
      downloadUrl: null,
      notesUrl: page,
    });
  });
});
