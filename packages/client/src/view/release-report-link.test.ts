import { describe, expect, test } from "vitest";
import { RELEASE_REPORT_SITE_URL, releaseReportUrl } from "./release-report-link.js";

describe("releaseReportUrl", () => {
  test("on the web it resolves against the page, so a preview or a subpath opens its own copy", () => {
    expect(releaseReportUrl("http://localhost:5193/?unlock=all", false)).toBe(
      "http://localhost:5193/releases/v0.40.0/index.html",
    );
    expect(releaseReportUrl("https://deploy-preview-354--x.netlify.app/#link=abc", false)).toBe(
      "https://deploy-preview-354--x.netlify.app/releases/v0.40.0/index.html",
    );
    expect(releaseReportUrl("https://example.org/game/index.html", false)).toBe(
      "https://example.org/game/releases/v0.40.0/index.html",
    );
  });

  test("in the native apps it is the production site", () => {
    expect(releaseReportUrl("tauri://localhost/", true)).toBe(RELEASE_REPORT_SITE_URL);
    expect(RELEASE_REPORT_SITE_URL).toBe(
      "https://marvel-champions-digital-game.netlify.app/releases/v0.40.0/index.html",
    );
  });

  test("a page url that cannot be resolved against falls back to the site", () => {
    expect(releaseReportUrl("not a url", false)).toBe(RELEASE_REPORT_SITE_URL);
  });
});
