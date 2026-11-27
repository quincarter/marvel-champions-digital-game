import { describe, expect, it } from "vitest";
import { layoutRoomGive } from "./room-give-layout.js";

const base = { titleHeight: 24, emptyHeight: null, target: 44 };

describe("layoutRoomGive", () => {
  for (const [width, height] of [
    [375, 667],
    [667, 375],
  ] as const) {
    it(`keeps 25 recipients and Cancel on screen at ${width}x${height}`, () => {
      const l = layoutRoomGive({ ...base, width, height, recipients: 25 });
      expect(l.box.y).toBeGreaterThanOrEqual(12);
      expect(l.box.y + l.box.height).toBeLessThanOrEqual(height - 12);
      expect(l.contentHeight).toBe(25 * 50);
      expect(l.list.height).toBeLessThan(l.contentHeight);
      // The list ends above Cancel, which is inside the box.
      expect(l.list.y + l.list.height).toBeLessThanOrEqual(l.cancel.y);
      expect(l.cancel.y + l.cancel.height).toBeLessThanOrEqual(l.box.y + l.box.height);
      expect(l.list.height).toBeGreaterThan(0);
    });
  }

  it("does not scroll a short list", () => {
    const l = layoutRoomGive({ ...base, width: 1024, height: 768, recipients: 3 });
    expect(l.list.height).toBe(l.contentHeight);
  });
});
