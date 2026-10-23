import { describe, expect, test } from "vitest";
import { SHADOWLAND_INFO_SITE_URL, shadowlandInfoUrl } from "./shadowland-info-link.js";

describe("shadowlandInfoUrl", () => {
  test("on the web it resolves against the page, so a preview or a subpath opens its own copy", () => {
    expect(shadowlandInfoUrl("http://localhost:5193/?unlock=all", false)).toBe(
      "http://localhost:5193/shadowland-info.html",
    );
    expect(shadowlandInfoUrl("https://deploy-preview-354--x.netlify.app/#link=abc", false)).toBe(
      "https://deploy-preview-354--x.netlify.app/shadowland-info.html",
    );
    expect(shadowlandInfoUrl("https://example.org/game/index.html", false)).toBe(
      "https://example.org/game/shadowland-info.html",
    );
  });

  test("in the native apps it is the production site", () => {
    expect(shadowlandInfoUrl("tauri://localhost/", true)).toBe(SHADOWLAND_INFO_SITE_URL);
    expect(SHADOWLAND_INFO_SITE_URL).toBe("https://marvel-champions-digital-game.netlify.app/shadowland-info.html");
  });

  test("a page url that cannot be resolved against falls back to the site", () => {
    expect(shadowlandInfoUrl("not a url", false)).toBe(SHADOWLAND_INFO_SITE_URL);
  });
});
