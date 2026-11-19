import { describe, expect, it } from "vitest";
import {
  classifyAsset,
  compareVersions,
  percent,
  sameCounts,
  summarizeDownloads,
  type GitHubRelease,
} from "./download-stats.js";

describe("classifyAsset", () => {
  it("names each installer's platform, format and card language", () => {
    expect(classifyAsset("MarvelChampions-0.45.0-ES-Android.apk")).toEqual({
      type: "installer",
      platform: "android",
      kind: "apk",
      language: "es",
    });
    expect(classifyAsset("MarvelChampions-0.45.0-EN-macOS-Intel-x64.app.tar.gz")).toMatchObject({
      platform: "mac",
      kind: "appTarGz",
      language: "en",
    });
    expect(classifyAsset("MarvelChampions-0.30.0-Windows-x64-AllUsers.msi")).toMatchObject({
      platform: "windows",
      kind: "msi",
      language: null,
    });
    // v0.19.0's names, from before the release workflow renamed its files.
    expect(classifyAsset("marvel-champions-0.19.0.apk")).toMatchObject({ platform: "android" });
    expect(classifyAsset("Marvel.Champions_0.19.0_amd64.AppImage")).toMatchObject({ kind: "appImage" });
    expect(classifyAsset("Marvel.Champions-0.19.0-1.x86_64.rpm")).toMatchObject({ kind: "rpm" });
  });

  it("counts every Install for Steam file under its system, and nothing else that isn't an installer", () => {
    expect(classifyAsset("MarvelChampions-Linux-Install-for-Steam.tar.gz")).toEqual({ type: "steam", os: "linux" });
    expect(classifyAsset("MarvelChampions-Windows-Install-for-Steam.cmd")).toEqual({ type: "steam", os: "windows" });
    expect(classifyAsset("MarvelChampions-macOS-Install-for-Steam.sh")).toEqual({ type: "steam", os: "mac" });
    expect(classifyAsset("MarvelChampions-0.38.0-Windows-Install-for-Steam.ps1")).toEqual({
      type: "steam",
      os: "windows",
    });
    expect(classifyAsset("SHA256SUMS.txt")).toBeNull();
    expect(classifyAsset("champions-digital-game-mod-sdk-0.45.0.tgz")).toBeNull();
    expect(classifyAsset("latest.json")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders by number, not by text", () => {
    expect(compareVersions("v0.9.0", "v0.19.0")).toBeLessThan(0);
    expect(compareVersions("v0.19.1", "v0.19.0")).toBeGreaterThan(0);
    expect(compareVersions("v1.0.0", "v1.0.0")).toBe(0);
  });
});

const asset = (name: string, download_count: number) => ({ name, download_count });

const RELEASES: GitHubRelease[] = [
  {
    tag_name: "v0.18.0",
    published_at: "2026-10-10T00:00:00Z",
    assets: [asset("marvel-champions-0.18.0.apk", 40), asset("SHA256SUMS.txt", 9)],
  },
  {
    tag_name: "v0.19.0",
    published_at: "2026-10-11T00:00:00Z",
    assets: [asset("marvel-champions-0.19.0.apk", 38), asset("Marvel.Champions_0.19.0_x64-setup.exe", 21)],
  },
  {
    tag_name: "v0.39.0",
    published_at: "2026-10-28T00:00:00Z",
    assets: [
      asset("MarvelChampions-0.39.0-EN-Android.apk", 50),
      asset("MarvelChampions-0.39.0-ES-Android.apk", 24),
      asset("MarvelChampions-0.39.0-EN-Linux-x64.deb", 6),
      asset("MarvelChampions-Linux-Install-for-Steam.sh", 10),
      asset("MarvelChampions-Windows-Install-for-Steam.cmd", 6),
      asset("SHA256SUMS.txt", 3),
    ],
  },
  { tag_name: "v0.40.0", draft: true, assets: [asset("MarvelChampions-0.40.0-EN-Android.apk", 99)] },
  { tag_name: "v0.40.0-rc.1", prerelease: true, assets: [asset("MarvelChampions-0.40.0-EN-Android.apk", 99)] },
];

describe("summarizeDownloads", () => {
  const stats = summarizeDownloads(RELEASES, "v0.19.0", "2026-11-16T12:00:00Z");

  it("counts published releases from the first counted one on, newest first", () => {
    expect(stats.releases.map((release) => release.version)).toEqual(["v0.39.0", "v0.19.0"]);
    expect(stats.installers).toBe(38 + 21 + 50 + 24 + 6);
  });

  it("splits installers by platform and format, per release and in all", () => {
    expect(stats.platforms).toEqual({ android: 112, windows: 21, mac: 0, linux: 6 });
    expect(stats.files.apk).toBe(112);
    expect(stats.files.exe).toBe(21);
    expect(stats.files.deb).toBe(6);
    expect(stats.releases[0]!.platforms).toEqual({ android: 74, windows: 0, mac: 0, linux: 6 });
  });

  it("counts Steam script runs apart from installers, from the first release that had them", () => {
    expect(stats.steam).toEqual({ total: 16, since: "v0.39.0", linux: 10, windows: 6, mac: 0 });
    expect(stats.releases[0]!.steam).toBe(16);
    expect(stats.releases[1]!.steam).toBeNull();
  });

  it("splits card languages from the first release that names them", () => {
    expect(stats.languages).toEqual({ since: "v0.39.0", counts: { en: 56, es: 24 } });
  });

  it("ranks the releases with the most installer downloads", () => {
    expect(stats.top.map((release) => release.version)).toEqual(["v0.39.0", "v0.19.0"]);
  });

  it("has no language split before any release named one", () => {
    expect(summarizeDownloads(RELEASES.slice(0, 2), "v0.19.0", "").languages).toBeNull();
  });
});

describe("percent", () => {
  it("rounds to a whole number and survives an empty whole", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});

describe("sameCounts", () => {
  it("ignores when the counts were taken, and sees any download since", () => {
    const morning = summarizeDownloads(RELEASES, "v0.19.0", "2026-11-16T06:17:00Z");
    const evening = summarizeDownloads(RELEASES, "v0.19.0", "2026-11-16T18:17:00Z");
    expect(sameCounts(morning, evening)).toBe(true);
    const more = RELEASES.map((release) =>
      release.tag_name === "v0.39.0"
        ? { ...release, assets: release.assets.map((a, i) => (i === 0 ? { ...a, download_count: 51 } : a)) }
        : release,
    );
    expect(sameCounts(morning, summarizeDownloads(more, "v0.19.0", "2026-11-16T18:17:00Z"))).toBe(false);
  });

  it("matches the counts after a round trip through the published JSON", () => {
    const stats = summarizeDownloads(RELEASES, "v0.19.0", "now");
    expect(sameCounts(stats, JSON.parse(JSON.stringify(stats)))).toBe(true);
  });
});
