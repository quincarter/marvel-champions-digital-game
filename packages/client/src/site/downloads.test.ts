import {
  detectDevice,
  downloadHref,
  IOS_SECTION_ID,
  downloadsOf,
  primaryButtons,
  primaryDownload,
  sameRelease,
  steamButtonFor,
  steamScriptFor,
  versionOf,
  type LatestRelease,
} from "./downloads.js";

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

  it("is none for iOS on a release without an .ipa, or an unknown device", () => {
    expect(primaryDownload(downloads, "ios")).toBeUndefined();
    expect(primaryDownload(downloads, "other")).toBeUndefined();
  });

  it("is the sideload .ipa on iOS, in the page's language (#874)", () => {
    const withIpa: LatestRelease = {
      ...RELEASE,
      assets: [
        ...RELEASE.assets,
        asset("MarvelChampions-0.44.0-EN-iOS-unsigned.ipa"),
        asset("MarvelChampions-0.44.0-ES-iOS-unsigned.ipa"),
      ],
    };
    expect(primaryDownload(downloadsOf(withIpa, "en"), "ios")?.fileName).toBe(
      "MarvelChampions-0.44.0-EN-iOS-unsigned.ipa",
    );
    expect(primaryDownload(downloadsOf(withIpa, "es"), "ios")?.fileName).toBe(
      "MarvelChampions-0.44.0-ES-iOS-unsigned.ipa",
    );
  });
});

describe("steamScriptFor", () => {
  it("gives each computer its own Install for Steam script, and a phone none", () => {
    const downloads = downloadsOf(
      {
        ...RELEASE,
        assets: [
          ...RELEASE.assets,
          asset("MarvelChampions-macOS-Install-for-Steam.sh"),
          asset("MarvelChampions-Linux-Install-for-Steam.sh"),
        ],
      },
      "en",
    );
    expect(steamScriptFor(downloads, "windows")?.id).toBe("steam-windows");
    expect(steamScriptFor(downloads, "mac")?.id).toBe("steam-mac");
    expect(steamScriptFor(downloads, "linux")?.fileName).toBe("MarvelChampions-Linux-Install-for-Steam.sh");
    expect(steamScriptFor(downloads, "android")).toBeUndefined();
    expect(steamScriptFor(downloads, "ios")).toBeUndefined();
  });
});

describe("primaryButtons", () => {
  const MAC_ARM = "MarvelChampions-0.44.0-EN-macOS-AppleSilicon-arm64.dmg";
  const MAC_INTEL = "MarvelChampions-0.44.0-EN-macOS-Intel-x64.dmg";
  const withAssets = (...names: string[]): LatestRelease => ({ ...RELEASE, assets: names.map(asset) });
  const buttonsOf = (release: LatestRelease, device: Parameters<typeof primaryButtons>[1]) =>
    primaryButtons(downloadsOf(release, "en"), device).map(({ download, labelKey }) => [download.fileName, labelKey]);

  it("gives a Mac one button per chip, each named for its own installer", () => {
    expect(buttonsOf(withAssets(MAC_ARM, MAC_INTEL), "mac")).toEqual([
      [MAC_ARM, "device.macArm"],
      [MAC_INTEL, "device.macIntel"],
    ]);
  });

  it("names an Intel-only release's one button for Intel, not Apple silicon", () => {
    expect(buttonsOf(withAssets(MAC_INTEL), "mac")).toEqual([[MAC_INTEL, "device.macIntel"]]);
  });

  it("names an Apple-silicon-only release's one button for Apple silicon", () => {
    expect(buttonsOf(withAssets(MAC_ARM), "mac")).toEqual([[MAC_ARM, "device.macArm"]]);
  });

  it("gives a Mac no button when the release has neither installer", () => {
    expect(buttonsOf(withAssets("MarvelChampions-macOS-Install-for-Steam.sh"), "mac")).toEqual([]);
  });

  it("gives any other device its first installer, named for the device", () => {
    expect(buttonsOf(RELEASE, "windows")).toEqual([
      ["MarvelChampions-0.44.0-EN-Windows-x64-Setup.exe", "device.windows"],
    ]);
    expect(buttonsOf(RELEASE, "ios")).toEqual([]);
  });
});

describe("steamButtonFor", () => {
  it("offers the script only beside an installer for the device, as the download section does", () => {
    expect(steamButtonFor(downloadsOf(RELEASE, "en"), "windows")?.id).toBe("steam-windows");
    // The script is up but the installers are still uploading: no button that would skip the section's help.
    const scriptOnly = { ...RELEASE, assets: [asset("MarvelChampions-Windows-Install-for-Steam.cmd")] };
    expect(steamScriptFor(downloadsOf(scriptOnly, "en"), "windows")).toBeDefined();
    expect(steamButtonFor(downloadsOf(scriptOnly, "en"), "windows")).toBeUndefined();
  });
});

describe("sameRelease", () => {
  it("tells a release whose files have grown since from the one the page has", () => {
    const grown = { ...RELEASE, assets: [...RELEASE.assets, asset("MarvelChampions-Linux-Install-for-Steam.sh")] };
    expect(sameRelease(RELEASE, { ...RELEASE })).toBe(true);
    expect(sameRelease(RELEASE, grown)).toBe(false);
    expect(sameRelease(RELEASE, { ...RELEASE, tag_name: "v0.45.0" })).toBe(false);
  });
});

it("versionOf drops the tag's v", () => {
  expect(versionOf(RELEASE)).toBe("0.44.0");
});

describe("downloadHref", () => {
  it("sends the iOS app's buttons to its install steps, and every other download to its file (#874)", () => {
    const withIpa: LatestRelease = {
      ...RELEASE,
      assets: [...RELEASE.assets, asset("MarvelChampions-0.44.0-EN-iOS-unsigned.ipa")],
    };
    const downloads = downloadsOf(withIpa, "en");
    expect(downloadHref(primaryDownload(downloads, "ios")!)).toBe(`#${IOS_SECTION_ID}`);
    const apk = primaryDownload(downloads, "android")!;
    expect(downloadHref(apk)).toBe(apk.url);
  });
});
