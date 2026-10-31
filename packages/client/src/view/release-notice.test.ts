import { describe, expect, test } from "vitest";
import {
  RELEASE_NOTICE_LINK,
  RELEASE_NOTICE_LINK_SHORT,
  RELEASE_NOTICE_TEXT,
  RELEASE_NOTICE_VERSION,
  noticeBarParts,
} from "./release-notice.js";

test("the bar names the release it opens", () => {
  expect(RELEASE_NOTICE_TEXT).toContain(RELEASE_NOTICE_VERSION);
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
    expect(noticeBarParts(bar(360), 70).link).toBe(RELEASE_NOTICE_LINK_SHORT);
  });
});
