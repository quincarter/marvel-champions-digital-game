import { cacheControlFor, contentTypeOf, isHashedAsset, keyFor, prOfHost, sniffImageType } from "./layout.ts";

describe("prOfHost", () => {
  it("reads the pull request from a preview host", () => {
    expect(prOfHost("pr-677.champions-digital-game.com")).toBe(677);
    expect(prOfHost("PR-12.champions-digital-game.com")).toBe(12);
  });

  it("refuses every other host", () => {
    for (const host of [
      "champions-digital-game.com",
      "www.champions-digital-game.com",
      "packs.champions-digital-game.com",
      "pr-0.champions-digital-game.com",
      "pr-012.champions-digital-game.com",
      "pr-.champions-digital-game.com",
      "xpr-12.champions-digital-game.com",
      "pr-12",
    ]) {
      expect(prOfHost(host), host).toBeNull();
    }
  });
});

describe("keyFor", () => {
  it("files a hashed Vite asset once for every PR", () => {
    expect(keyFor("assets/index-B4qWg0Py.js", 5, "en")).toBe("shared/assets/index-B4qWg0Py.js");
    expect(keyFor("assets/aspect-lesson-BLD55F6_.js", 5, "en")).toBe("shared/assets/aspect-lesson-BLD55F6_.js");
    expect(keyFor("assets/title-theme-u1WnHvUN.mp3", 9, "es")).toBe("shared/assets/title-theme-u1WnHvUN.mp3");
  });

  it("keeps files public/assets copies unhashed with their PR", () => {
    expect(isHashedAsset("assets/first-player-token.svg")).toBe(false);
    expect(keyFor("assets/controllers/xbox.png", 5, "en")).toBe("pr-5/assets/controllers/xbox.png");
  });

  it("files card scans by language, /card-art/ in the build's own", () => {
    expect(keyFor("card-art/bundles/cards/01001a.png", 5, "en")).toBe("shared/card-art/en/bundles/cards/01001a.png");
    expect(keyFor("card-art-es/bundles/cards/01001a.png", 5, "en")).toBe("shared/card-art/es/bundles/cards/01001a.png");
    // A "Spanish preview" build: /card-art/ is Spanish, /card-art-en/ English.
    expect(keyFor("card-art/bundles/cards/01001a.png", 5, "es")).toBe("shared/card-art/es/bundles/cards/01001a.png");
    expect(keyFor("card-art-en/bundles/cards/01001a.png", 5, "es")).toBe("shared/card-art/en/bundles/cards/01001a.png");
  });

  it("puts everything else under the PR", () => {
    expect(keyFor("index.html", 5, "en")).toBe("pr-5/index.html");
    expect(keyFor("releases/v0.43.2/index.html", 5, "en")).toBe("pr-5/releases/v0.43.2/index.html");
    expect(keyFor("packs/index.json", 5, "en")).toBe("pr-5/packs/index.json");
  });

  it("refuses a path that climbs out or has empty segments", () => {
    for (const path of ["", "../pr-6/index.html", "a/../b", "a//b", "./index.html", "a\\b", "card-art/../../x"]) {
      expect(keyFor(path, 5, "en"), path).toBeNull();
    }
  });
});

describe("headers", () => {
  it("caches hashed assets and scans for a year and revalidates the rest", () => {
    expect(cacheControlFor("assets/index-B4qWg0Py.js")).toContain("immutable");
    expect(cacheControlFor("card-art/bundles/cards/01001a.png")).toContain("immutable");
    expect(cacheControlFor("card-art-es/bundles/cards/01001a.png")).toContain("immutable");
    expect(cacheControlFor("index.html")).toContain("max-age=0");
    expect(cacheControlFor("assets/first-player-token.svg")).toContain("max-age=0");
  });

  it("types files by extension", () => {
    expect(contentTypeOf("index.html")).toMatch(/^text\/html/);
    expect(contentTypeOf("a/b.WOFF2")).toBe("font/woff2");
    expect(contentTypeOf("README")).toBe("application/octet-stream");
  });

  it("sniffs WebP filed under a .png name", () => {
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
