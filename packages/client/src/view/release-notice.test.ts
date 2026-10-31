import { existsSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  RELEASE_NOTICE_LINK,
  RELEASE_NOTICE_LINK_SHORT,
  RELEASE_NOTICE_TEXT,
  RELEASE_NOTICE_VERSION,
  noticeBarParts,
  noticeGlyphSpot,
  noticeVersionOf,
  releaseNoticeText,
} from "./release-notice.js";

test("the bar names the release it opens, and that release's report is in the site", () => {
  expect(RELEASE_NOTICE_TEXT).toContain(RELEASE_NOTICE_VERSION);
  // A missing page would not 404: the site's fallback would open a second copy of the game.
  const report = new URL(`../../public/releases/${RELEASE_NOTICE_VERSION}/index.html`, import.meta.url);
  expect(existsSync(report)).toBe(true);
});

test("the bar follows GitHub's latest release, keeps its own when GitHub gives none, and the flag turns that off", () => {
  expect(noticeVersionOf("9.1.0", true)).toBe("v9.1.0");
  expect(noticeVersionOf(null, true)).toBe(RELEASE_NOTICE_VERSION);
  expect(noticeVersionOf("9.1.0", false)).toBe(RELEASE_NOTICE_VERSION);
  expect(releaseNoticeText("v9.1.0")).toBe("What's new in v9.1.0");
});

describe("noticeBarParts", () => {
  const bar = (width: number) => ({ x: 0, y: 0, width, height: 40 });

  test("a wide bar spells the link out and keeps its parts inside the bar", () => {
    const parts = noticeBarParts(bar(1280), 70);
    expect(parts.link).toBe(RELEASE_NOTICE_LINK);
    expect(parts.tagX).toBeGreaterThan(0);
    expect(parts.linkRight).toBeLessThan(1280);
    expect(parts.midY).toBe(20);
  });

  test("a narrow phone bar keeps only the arrow, so the message has room", () => {
    expect(noticeBarParts(bar(320), 70).link).toBe(RELEASE_NOTICE_LINK_SHORT);
  });
});

describe("noticeGlyphSpot", () => {
  test("the press glyph sits just left of the link", () => {
    expect(noticeGlyphSpot(300, 200, 20, 18)).toEqual({ x: 272, y: 20 });
  });

  test("a glyph that would run into the message is left out", () => {
    expect(noticeGlyphSpot(300, 270, 20, 18)).toBeNull();
  });
});
