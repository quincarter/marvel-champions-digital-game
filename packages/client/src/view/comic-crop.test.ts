import { describe, expect, it } from "vitest";
import { coverCropFavoringBeats } from "./comic-crop.js";
import type { RunPageCrop } from "./campaign-run-model.js";

describe("coverCropFavoringBeats", () => {
  it("centers plainly when the union has no real gap between its beats", () => {
    const crop: RunPageCrop = {
      file: "01-badoon",
      width: 1500,
      height: 1500,
      rect: { x: 0, y: 0, w: 1500, h: 1500 },
      beats: [{ x: 0, y: 0, w: 1500, h: 1500 }],
    };
    const fit = coverCropFavoringBeats(crop, { width: 230, height: 800 });
    // A single beat filling the whole union: the crop window's own center lands on the beat's center either way.
    expect(fit.cropX + fit.cropWidth / 2).toBeCloseTo(750, 0);
  });

  it("GMW's 02-museum split: issue #2's crop favors its own left inset, not the blacked-out gap between it and #3's", () => {
    // The real rects from `campaign/stories/gmw.ts`: issue #2 uses the top gallery band and the left inset; the
    // solid-black "alarm cutting the lights" gap sits between the left inset (ending x474) and the right inset
    // (starting x979) — a naive centered crop of their union falls squarely inside it.
    const crop: RunPageCrop = {
      file: "02-museum",
      width: 1500,
      height: 1500,
      rect: { x: 0, y: 0, w: 1500, h: 1082 },
      beats: [
        { x: 0, y: 0, w: 1500, h: 330 },
        { x: 62, y: 355, w: 412, h: 727 },
      ],
    };
    const fit = coverCropFavoringBeats(crop, { width: 230, height: 800 });
    const windowStart = fit.cropX;
    const windowEnd = fit.cropX + fit.cropWidth;
    // The window must land inside (or overlapping) the left inset's own horizontal span, not the black gap
    // (474 to 979) a bare bounding-box center would land in.
    const overlapsLeftInset = windowStart < 474 && windowEnd > 62;
    expect(overlapsLeftInset).toBe(true);
    expect(windowStart).toBeLessThan(474);
  });

  it("never returns a crop rect larger than the page it draws from", () => {
    const crop: RunPageCrop = {
      file: "05-ronan",
      width: 1920,
      height: 993,
      rect: { x: 0, y: 0, w: 1920, h: 993 },
      beats: [{ x: 0, y: 0, w: 1920, h: 993 }],
    };
    const fit = coverCropFavoringBeats(crop, { width: 1440, height: 980 });
    expect(fit.cropX).toBeGreaterThanOrEqual(0);
    expect(fit.cropY).toBeGreaterThanOrEqual(0);
    expect(fit.cropX + fit.cropWidth).toBeLessThanOrEqual(crop.rect.x + crop.rect.w + 0.01);
    expect(fit.cropY + fit.cropHeight).toBeLessThanOrEqual(crop.rect.y + crop.rect.h + 0.01);
  });
});
