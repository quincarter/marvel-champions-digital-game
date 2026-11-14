import { detectDevice, downloadsOf, primaryDownload, versionOf, type LatestRelease } from "./downloads.js";

const asset = (name: string) => ({ name, browser_download_url: `https://example.test/${name}` });

const RELEASE: LatestRelease = {
  tag_name: "v0.44.0",
  html_url: "https://example.test/releases/v0.44.0",
  assets: [
    "MarvelChampions-0.44.0-EN-Android.apk",
    "MarvelChampions-0.44.0-ES-Android.apk",
    "MarvelChampions-0.44.0-EN-Linux-x64.AppImage",
    "MarvelChampions-0.44.0-EN-Linux-x64.deb",
    "MarvelChampions-0.44.0-EN-macOS-AppleSilicon-arm64.dmg",
    "MarvelChampions-0.44.0-EN-macOS-AppleSilicon-arm64.app.tar.gz",
    "MarvelChampions-0.44.0-EN-macOS-Intel-x64.dmg",
    "MarvelChampions-0.44.0-EN-Windows-x64-AllUsers.msi",
    "MarvelChampions-0.44.0-EN-Windows-x64-Setup.exe",
    "MarvelChampions-0.44.0-ES-Windows-x64-Setup.exe",
    "MarvelChampions-Windows-Install-for-Steam.cmd",
    "SHA256SUMS.txt",
  ].map(asset),
};

describe("detectDevice", () => {
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140", "windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605", "mac"],
    ["Mozilla/5.0 (X11; Linux x86_64) Firefox/140", "linux"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 10) Chrome/140 Mobile", "android"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604", "ios"],
    ["Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) Chrome/140", "linux"],
    ["curl/8.0", "other"],
  ] as const)("reads %s as %s", (userAgent, device) => {
    expect(detectDevice({ userAgent })).toBe(device);
  });

  it("takes an iPad in desktop mode, which says Macintosh but has touch, for iOS", () => {
    expect(detectDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })).toBe(
      "ios",
    );
  });

  it("trusts the client hint's platform over the user agent", () => {
    expect(detectDevice({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)", uaPlatform: "Android" })).toBe("android");
  });
});

describe("downloadsOf", () => {
  it("offers the build in the page's language where the release has one, else English", () => {
    const spanish = downloadsOf(RELEASE, "es");
    expect(spanish.find((d) => d.id === "windows-setup")?.fileName).toContain("-ES-");
    expect(spanish.find((d) => d.id === "windows-msi")?.fileName).toContain("-EN-");
    expect(downloadsOf(RELEASE, "en").find((d) => d.id === "android-apk")?.fileName).toContain("-EN-");
  });

  it("lists each installer once, leaves out what the release lacks and ignores other files", () => {
    const ids = downloadsOf(RELEASE, "en").map((d) => d.id);
    expect(ids).toEqual([
      "windows-setup",
      "windows-msi",
      "mac-arm",
      "mac-intel",
      "linux-appimage",
      "linux-deb",
      "android-apk",
      "steam-windows",
    ]);
  });

  it("marks the Steam script as language-free", () => {
    expect(downloadsOf(RELEASE, "en").find((d) => d.id === "steam-windows")?.language).toBeNull();
  });
});

describe("primaryDownload", () => {
  const downloads = downloadsOf(RELEASE, "en");

  it("is a device's first installer, never its Steam script", () => {
    expect(primaryDownload(downloads, "windows")?.id).toBe("windows-setup");
    expect(primaryDownload(downloads, "mac")?.id).toBe("mac-arm");
    expect(primaryDownload(downloads, "android")?.id).toBe("android-apk");
  });

  it("is none for iOS, which has no app, or an unknown device", () => {
    expect(primaryDownload(downloads, "ios")).toBeUndefined();
    expect(primaryDownload(downloads, "other")).toBeUndefined();
  });
});

it("versionOf drops the tag's v", () => {
  expect(versionOf(RELEASE)).toBe("0.44.0");
});
