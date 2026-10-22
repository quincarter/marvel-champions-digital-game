import { describe, expect, test } from "vitest";
import { SYNC_INFO_SITE_URL, syncInfoUrl } from "./sync-info-link.js";

describe("syncInfoUrl", () => {
  test("on the web it resolves against the page, so a preview or a subpath opens its own copy", () => {
    expect(syncInfoUrl("http://localhost:5193/?unlock=all", false)).toBe("http://localhost:5193/sync-info.html");
    expect(syncInfoUrl("https://deploy-preview-354--x.netlify.app/#link=abc", false)).toBe(
      "https://deploy-preview-354--x.netlify.app/sync-info.html",
    );
    expect(syncInfoUrl("https://example.org/game/index.html", false)).toBe("https://example.org/game/sync-info.html");
  });

  test("in the native apps it is the production site", () => {
    expect(syncInfoUrl("tauri://localhost/", true)).toBe(SYNC_INFO_SITE_URL);
    expect(SYNC_INFO_SITE_URL).toBe("https://marvel-champions-digital-game.netlify.app/sync-info.html");
  });

  test("a page url that cannot be resolved against falls back to the site", () => {
    expect(syncInfoUrl("not a url", false)).toBe(SYNC_INFO_SITE_URL);
  });
});
