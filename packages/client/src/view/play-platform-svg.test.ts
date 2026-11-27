import { describe, expect, it } from "vitest";
import { playPlatformMarkOf } from "./play-platform-mark.js";
import { playPlatformSvgOps } from "./play-platform-svg.js";

describe("playPlatformSvgOps", () => {
  it("draws one shape per shape of the mark, in the color and alpha given", () => {
    const mark = playPlatformMarkOf({ platform: "web" });
    expect(mark).not.toBeNull();
    const ops = playPlatformSvgOps(mark!, "#111", 0.85);
    expect(ops).toHaveLength(mark!.shapes.length);
    for (const op of ops) {
      if (op.k === "text" || op.k === "image") throw new Error("a mark has no text or picture");
      expect(op.alpha).toBe(0.85);
      expect(op.fill === "#111" || op.stroke === "#111").toBe(true);
    }
  });
});
