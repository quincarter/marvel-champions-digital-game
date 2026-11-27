import { describe, expect, it } from "vitest";
import { layoutNotice, noticeButtonKey, noticeButtonOf, noticeTextKey } from "./option-notice-layout.js";

const long = {
  titleHeight: 48,
  leadHeight: 60,
  rowTextHeights: [40, 90, 90, 90, 90],
  buttonHeight: 52,
};

describe("layoutNotice", () => {
  for (const [width, height, stacked] of [
    [375, 500, false],
    [375, 667, true],
    [667, 375, true],
  ] as const) {
    it(`keeps a long notice's buttons on screen at ${width}x${height}`, () => {
      const l = layoutNotice({ ...long, width, height, stacked });
      expect(l.box.y).toBeGreaterThanOrEqual(16);
      expect(l.box.y + l.box.height).toBeLessThanOrEqual(height - 16);
      expect(l.scroll.height).toBeLessThan(l.contentHeight);
      expect(l.scroll.height).toBeGreaterThan(0);
      const stackedTop = stacked ? l.buttonY - long.buttonHeight - 10 : l.buttonY;
      expect(l.scroll.y + l.scroll.height).toBeLessThanOrEqual(stackedTop);
      expect(l.buttonY + long.buttonHeight).toBeLessThanOrEqual(l.box.y + l.box.height);
    });
  }

  it("does not scroll a short notice", () => {
    const l = layoutNotice({ ...long, rowTextHeights: [20], width: 1024, height: 768, stacked: false });
    expect(l.scroll.height).toBe(l.contentHeight);
  });
});

describe("notice button identity", () => {
  it("names the button, the notice and the action, so the same button of two notices differs", () => {
    expect(noticeButtonKey("never", 1, false)).not.toBe(noticeButtonKey("never", 2, false));
    expect(noticeButtonKey("never", 1, false)).not.toBe(noticeButtonKey("never", 1, true));
  });

  it("answers only for the current notice", () => {
    expect(noticeButtonOf(noticeButtonKey("never", 3, true), 3)).toBe("never");
    expect(noticeButtonOf(noticeButtonKey("ok", 3, false), 3)).toBe("ok");
    expect(noticeButtonOf(noticeButtonKey("never", 3, false), 4)).toBeNull();
    expect(noticeButtonOf("cancel", 3)).toBeNull();
  });
});

describe("noticeTextKey", () => {
  test("is one key per notice, so a queued notice does not inherit the last one's scroll", () => {
    expect(noticeTextKey(1)).not.toBe(noticeTextKey(2));
    expect(noticeTextKey(2)).toBe(noticeTextKey(2));
  });
});
