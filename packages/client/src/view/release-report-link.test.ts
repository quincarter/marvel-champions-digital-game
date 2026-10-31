import { describe, expect, test } from "vitest";
import { RELEASE_NOTICE_VERSION } from "./release-notice.js";
import { RELEASE_REPORT_SITE_URL, releaseHistoryUrl, releaseReportUrl } from "./release-report-link.js";

const REPORT = `releases/${RELEASE_NOTICE_VERSION}/index.html`;

describe("releaseReportUrl", () => {
  test("on the web it resolves against the page, so a preview or a subpath opens its own copy", () => {
    expect(releaseReportUrl("http://localhost:5193/?unlock=all", false)).toBe(`http://localhost:5193/${REPORT}`);
    expect(releaseReportUrl("https://deploy-preview-354--x.netlify.app/#link=abc", false)).toBe(
      `https://deploy-preview-354--x.netlify.app/${REPORT}`,
    );
    expect(releaseReportUrl("https://example.org/game/index.html", false)).toBe(`https://example.org/game/${REPORT}`);
  });

  test("in the native apps it is the production site", () => {
    expect(releaseReportUrl("tauri://localhost/", true)).toBe(RELEASE_REPORT_SITE_URL);
    expect(RELEASE_REPORT_SITE_URL).toBe(`https://marvel-champions-digital-game.netlify.app/${REPORT}`);
  });

  test("a page url that cannot be resolved against falls back to the site", () => {
    expect(releaseReportUrl("not a url", false)).toBe(RELEASE_REPORT_SITE_URL);
  });
});

test("a release newer than this build's report opens in the history", () => {
  expect(releaseReportUrl("http://localhost:5193/", false, "v9.1.0")).toBe(
    "http://localhost:5193/releases/index.html#v9.1.0",
  );
});

describe("releaseHistoryUrl", () => {
  test("opens the history at the running release, on this site or on the production one", () => {
    expect(releaseHistoryUrl("0.40.0", "http://localhost:5193/?unlock=all", false)).toBe(
      "http://localhost:5193/releases/index.html#v0.40.0",
    );
    expect(releaseHistoryUrl("0.40.0", "tauri://localhost/", true)).toBe(
      "https://marvel-champions-digital-game.netlify.app/releases/index.html#v0.40.0",
    );
    expect(releaseHistoryUrl("0.40.0", "not a url", false)).toBe(
      "https://marvel-champions-digital-game.netlify.app/releases/index.html#v0.40.0",
    );
  });
});
