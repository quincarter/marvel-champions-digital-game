import { describe, expect, test } from "vitest";
import { SHADOWLAND_NOTICE_LINK, SHADOWLAND_NOTICE_LINK_SHORT, noticeBarParts } from "./shadowland-notice.js";

describe("noticeBarParts", () => {
  const bar = (width: number) => ({ x: 0, y: 0, width, height: 40 });

  test("a wide bar spells the link out and keeps its parts inside the bar", () => {
    const parts = noticeBarParts(bar(1280), 70);
    expect(parts.link).toBe(SHADOWLAND_NOTICE_LINK);
    expect(parts.tagX).toBeGreaterThan(0);
    expect(parts.linkRight).toBeLessThan(1280);
    expect(parts.midY).toBe(20);
  });

  test("a narrow phone bar keeps only the arrow, so the message has room", () => {
    expect(noticeBarParts(bar(360), 70).link).toBe(SHADOWLAND_NOTICE_LINK_SHORT);
  });
});
