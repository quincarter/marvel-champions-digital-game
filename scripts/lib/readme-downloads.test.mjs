import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import {
  BUTTON_SVGS,
  bumpButton,
  bumpReadme,
  compareVersions,
  linkedAssets,
  publicationProblems,
  readmeVersion,
  releaseProblems,
  skipReason,
} from "./readme-downloads.mjs";

const REPO = "https://github.com/quincarter/marvel-champions-digital-game";
const README = [
  `[![Latest release](https://img.shields.io/badge/version-v0.47.0-e8730c)](${REPO}/releases/tag/v0.47.0)`,
  `<a href="${REPO}/releases/download/v0.47.0/MarvelChampions-0.47.0-EN-Windows-x64-Setup.exe"><img></a>`,
  `<a href="${REPO}/releases/download/v0.47.0/MarvelChampions-0.47.0-EN-macOS-AppleSilicon-arm64.dmg"><img></a>`,
  // A name from before the Spanish builds, which gains its `-EN-`.
  `<a href="${REPO}/releases/download/v0.30.0/MarvelChampions-0.30.0-Linux-x64.AppImage"><img></a>`,
  `<a href="${REPO}/releases/download/v0.47.0/MarvelChampions-0.47.0-ES-Android.apk"><img></a>`,
  `<a href="${REPO}/releases">all releases</a>`,
].join("\n");

const NAMES = [
  "MarvelChampions-0.48.0-EN-Windows-x64-Setup.exe",
  "MarvelChampions-0.48.0-EN-macOS-AppleSilicon-arm64.dmg",
  "MarvelChampions-0.48.0-EN-Linux-x64.AppImage",
  "MarvelChampions-0.48.0-ES-Android.apk",
];

describe("the README's download bump", () => {
  it("moves the badge, the release link and every button to the version", () => {
    const bumped = bumpReadme(README, "v0.48.0");
    assert.equal(readmeVersion(bumped), "v0.48.0");
    assert.match(bumped, /releases\/tag\/v0\.48\.0\)/);
    assert.deepEqual(linkedAssets(bumped, "v0.48.0"), NAMES);
    assert.doesNotMatch(bumped, /0\.47\.0|0\.30\.0/);
    assert.match(bumped, /releases">all releases/);
  });

  it("takes a version without its v", () => {
    assert.equal(bumpReadme(README, "0.48.0"), bumpReadme(README, "v0.48.0"));
  });

  it("refuses a prerelease version", () => {
    assert.throws(() => bumpReadme(README, "v0.48.0-rc.1"));
  });

  it("changes the version on a button's SVG", () => {
    assert.equal(bumpButton("<text>Windows · v0.47.0</text>", "v0.48.0"), "<text>Windows · v0.48.0</text>");
  });

  it("covers every download button the README shows", () => {
    const readme = fs.readFileSync(new URL("../../README.md", import.meta.url), "utf8");
    const shown = [...readme.matchAll(/\.github\/assets\/readme\/(download-[\w-]+\.svg)/g)].map((m) => m[1]);
    assert.deepEqual(new Set(shown), new Set(BUTTON_SVGS.map((svg) => svg.split("/").pop())));
    for (const svg of BUTTON_SVGS)
      assert.match(fs.readFileSync(new URL(`../../${svg}`, import.meta.url), "utf8"), /v\d/);
  });

  it("orders versions numerically", () => {
    assert.ok(compareVersions("v0.10.0", "v0.9.9") > 0);
    assert.ok(compareVersions("0.48.0", "v0.48.0") === 0);
    assert.ok(compareVersions("v0.47.1", "v0.48.0") < 0);
  });
});

describe("whether a release can take the README", () => {
  const bumped = bumpReadme(README, "v0.48.0");
  const published = {
    tagName: "v0.48.0",
    isDraft: false,
    isPrerelease: false,
    assets: NAMES.map((name) => ({ name })),
  };

  it("passes a published release with every linked file", () => {
    assert.deepEqual(releaseProblems(published, bumped), []);
  });

  it("names a draft or a prerelease before any skip, so the CLI fails on it rather than skipping it", () => {
    assert.deepEqual(publicationProblems(published), []);
    assert.deepEqual(publicationProblems({ ...published, isDraft: true, isPrerelease: true }), [
      "v0.48.0 is still a draft.",
      "v0.48.0 is a prerelease.",
    ]);
  });

  it("holds a draft or a prerelease", () => {
    assert.equal(releaseProblems({ ...published, isDraft: true }, bumped).length, 1);
    assert.equal(releaseProblems({ ...published, isPrerelease: true }, bumped).length, 1);
  });

  it("names a file the buttons link to that isn't uploaded", () => {
    const assets = published.assets.filter((asset) => !asset.name.endsWith(".apk"));
    assert.deepEqual(releaseProblems({ ...published, assets }, bumped), [
      "v0.48.0 has no MarvelChampions-0.48.0-ES-Android.apk.",
    ]);
  });
});

describe("when the README stays as it is", () => {
  const base = { tag: "v0.48.0", latest: "v0.48.0", current: "v0.47.0", pending: null };

  it("moves for GitHub's latest release, newer than main and the open pull request", () => {
    assert.equal(skipReason(base), null);
    assert.equal(skipReason({ ...base, pending: "v0.47.0" }), null);
  });

  it("skips a release published or retried out of order, once a newer one is latest", () => {
    // v0.49.0 is latest but its README pull request isn't open yet; a retry of v0.48.0 mustn't open one for v0.48.0.
    assert.match(skipReason({ ...base, latest: "v0.49.0" }), /not GitHub's latest release \(v0\.49\.0 is\)/);
  });

  it("skips an empty latest tag rather than guessing (the workflow fails before passing one)", () => {
    assert.match(skipReason({ ...base, latest: "" }), /no latest release/);
  });

  it("never moves main or the open pull request back", () => {
    assert.match(skipReason({ ...base, current: "v0.48.0" }), /The README already shows v0\.48\.0/);
    assert.match(skipReason({ ...base, pending: "v0.49.0" }), /open README pull request already shows v0\.49\.0/);
  });
});
