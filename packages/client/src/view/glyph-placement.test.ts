import { describe, expect, it } from "vitest";
import {
  glyphHangingBelow,
  glyphHeightFor,
  cancelLabel,
  glyphBesideLabel,
  glyphRect,
  hangIsClear,
  glyphOutsideButton,
  glyphRightInRow,
  glyphsFitFormFactor,
  glyphsFitLayout,
  legendHeightFor,
  legendLayout,
  scaledGlyphHeight,
  legendRect,
  legendSegments,
  specsSignature,
  zonesHintFits,
} from "./glyph-placement.js";

describe("glyphBesideLabel", () => {
  const button = { x: 100, y: 10, width: 200, height: 36 };
  const label = { cx: 200, width: 60, minX: 100, maxX: 300 };

  it("centers the glyph and word together when open", () => {
    // Pair = 20 + 6 + 60 = 86, so it starts at 200 - 43 = 157; the word slides 13 right of its center.
    const placed = glyphBesideLabel(button, label, 20, 20, 1)!;
    expect(placed.x).toBe(157);
    expect(placed.y).toBe(28);
    expect(placed.labelShift).toBe(13);
    // Glyph, gap, word: the word's left edge is 157 + 20 + 6.
    expect(label.cx + placed.labelShift - label.width / 2).toBe(157 + 20 + 6);
  });

  it("leaves the word where the button put it when closed", () => {
    expect(glyphBesideLabel(button, label, 20, 6, 0)!.labelShift).toBe(0);
  });

  it("is dropped, not squeezed, when the pair does not fit the button's padding", () => {
    expect(
      glyphBesideLabel({ x: 0, y: 0, width: 84, height: 36 }, { cx: 42, width: 60, minX: 0, maxX: 84 }, 28, 28, 1),
    ).toBeNull();
  });

  it("respects a left inset and a value on the right", () => {
    expect(glyphBesideLabel(button, { cx: 200, width: 60, minX: 160, maxX: 300 }, 20, 20, 1)).toBeNull();
    expect(glyphBesideLabel(button, { cx: 200, width: 60, minX: 100, maxX: 230 }, 20, 20, 1)).toBeNull();
  });

  it("decides on the full width, so the collapsed tab is never the only thing that fits", () => {
    expect(glyphBesideLabel(button, { cx: 200, width: 150, minX: 100, maxX: 300 }, 60, 6, 0.1)).toBeNull();
  });
});

describe("zonesHintFits", () => {
  it("fits with no note, and when the note starts well to its right", () => {
    expect(zonesHintFits(100, null)).toBe(true);
    expect(zonesHintFits(100, 400)).toBe(true);
  });

  it("is skipped when the note would run into it", () => {
    expect(zonesHintFits(100, 200)).toBe(false);
  });
});

describe("cancelLabel", () => {
  it("keeps the Esc text until a key or pad is in use, and on phones never has it", () => {
    expect(cancelLabel(true, null)).toBe("Cancel · Esc");
    expect(cancelLabel(true, "keyboard")).toBe("Cancel");
    expect(cancelLabel(true, "pad")).toBe("Cancel");
    expect(cancelLabel(false, null)).toBe("Cancel");
  });
});

describe("hanging glyph clearance", () => {
  it("is clear of empty space and not of a card", () => {
    const spot = glyphRect({ x: 100, y: 50 }, 40, 16);
    expect(spot).toEqual({ x: 100, y: 42, width: 40, height: 16 });
    expect(hangIsClear(spot, [{ x: 300, y: 0, width: 50, height: 50 }])).toBe(true);
    expect(hangIsClear(spot, [{ x: 120, y: 40, width: 50, height: 50 }])).toBe(false);
  });
});

describe("glyphOutsideButton", () => {
  const viewport = { x: 0, y: 0, width: 1000, height: 600 };

  it("hangs below the button, right edges aligned", () => {
    expect(glyphOutsideButton({ x: 700, y: 100, width: 120, height: 40 }, 50, 16, viewport)).toEqual({
      x: 770,
      y: 100 + 40 + 3 + 8,
    });
  });

  it("goes above when below would leave the screen", () => {
    expect(glyphOutsideButton({ x: 700, y: 560, width: 120, height: 40 }, 50, 16, viewport).y).toBe(560 - 3 - 8);
  });

  it("stays inside the viewport sideways", () => {
    expect(glyphOutsideButton({ x: 2, y: 100, width: 20, height: 40 }, 50, 16, viewport).x).toBe(0);
    expect(glyphOutsideButton({ x: 990, y: 100, width: 40, height: 40 }, 50, 16, viewport).x).toBe(950);
  });
});

describe("hanging and row placement", () => {
  it("hangs below the anchor on its right edge", () => {
    expect(glyphHangingBelow({ x: 300, y: 5, width: 76, height: 30 }, 40, 16)).toEqual({ x: 336, y: 5 + 30 + 3 + 8 });
  });

  it("right-aligns in a header row", () => {
    expect(glyphRightInRow({ x: 0, y: 0, width: 130, height: 400 }, 0, 20, 30, 7)).toEqual({ x: 93, y: 10 });
  });
});

describe("sizes and gating", () => {
  it("keeps the glyph inside the control's padding", () => {
    expect(glyphHeightFor(36)).toBe(20);
    expect(glyphHeightFor(24)).toBe(14);
    expect(glyphHeightFor(100)).toBe(20);
  });

  it("is for desktop and tablet landscape, never the tabbed phone layout", () => {
    expect(glyphsFitLayout(false)).toBe(true);
    expect(glyphsFitLayout(true)).toBe(false);
  });

  it("is for desktop and tablet landscape by form factor too", () => {
    expect(glyphsFitFormFactor("desktop")).toBe(true);
    expect(glyphsFitFormFactor("tabletLandscape")).toBe(true);
    for (const f of ["phone", "phoneLandscape", "tabletPortrait"]) expect(glyphsFitFormFactor(f)).toBe(false);
  });

  it("signs a spec list by its labels", () => {
    expect(specsSignature(null)).toBe("");
    expect(specsSignature([{ kind: "key", label: "Z", name: "Z key" }])).toBe("key:Z");
  });
});

describe("the focused-card legend", () => {
  it("lays items in a row with room for a glyph before its words", () => {
    const { slots, width } = legendLayout([
      { glyphWidth: 20, textWidth: 30 },
      { glyphWidth: 20, textWidth: 40 },
    ]);
    expect(slots[0]!.glyphX).toBe(8);
    expect(slots[0]!.textX).toBe(8 + 20 + 5);
    expect(slots[1]!.glyphX).toBe(slots[0]!.textX + 30 + 12);
    expect(width).toBe(slots[1]!.textX + 40 + 8);
  });

  it("sits above the card, clamped into the viewport, or below when there is no room above", () => {
    const viewport = { x: 0, y: 0, width: 800, height: 600 };
    expect(legendRect({ x: 380, y: 400, width: 80, height: 110 }, { width: 200, height: 20 }, viewport)).toEqual({
      x: 320,
      y: 376,
      width: 200,
      height: 20,
    });
    expect(legendRect({ x: 5, y: 400, width: 80, height: 110 }, { width: 200, height: 20 }, viewport).x).toBe(0);
    expect(legendRect({ x: 5, y: 10, width: 80, height: 110 }, { width: 200, height: 20 }, viewport).y).toBe(124);
  });

  it("says what Esc does right now, and offers hold-to-zoom while the zoom is on", () => {
    expect(legendSegments("back").map((s) => s.text)).toEqual(["Select", "Inspect · hold to zoom", "Back"]);
    expect(legendSegments("pause").map((s) => s.text)).toEqual(["Select", "Inspect · hold to zoom", "Pause"]);
    expect(legendSegments("back", false).map((s) => s.text)).toEqual(["Select", "Inspect", "Back"]);
    expect(legendSegments("back").map((s) => s.id)).toEqual(["activate", "inspect", "cancel"]);
  });
});

describe("hint size scaling (Settings.glyphSize)", () => {
  // A round face disc is as wide as it is tall, so a glyph's width follows its height.
  const button = { x: 100, y: 10, width: 160, height: 36 };
  const label = { cx: 180, width: 60, minX: 100, maxX: 260 };

  it("scales a base height by percent, to a whole pixel", () => {
    expect(scaledGlyphHeight(20, 100)).toBe(20);
    expect(scaledGlyphHeight(20, 75)).toBe(15);
    expect(scaledGlyphHeight(20, 130)).toBe(26);
    expect(scaledGlyphHeight(20, 200)).toBe(40);
    expect(glyphHeightFor(36, 200)).toBe(40);
    expect(glyphHeightFor(36)).toBe(20);
    expect(glyphHeightFor(20, 75)).toBe(Math.round(14 * 0.75));
  });

  it("sits beside the label at 75% and hangs outside at 200% when the pair no longer fits", () => {
    const small = scaledGlyphHeight(20, 75);
    const big = scaledGlyphHeight(20, 200);
    const beside = glyphBesideLabel(button, label, small, small, 1)!;
    expect(beside).not.toBeNull();
    // The word slides 10.5 right to make room: its left edge is the glyph's right edge plus the 6px gap.
    expect(beside.x).toBe(139.5);
    // Pair = 40 + 6 + 60 = 106, from 127 to 233: still inside the label box's padding.
    expect(glyphBesideLabel(button, label, big, big, 1)).not.toBeNull();
    // A narrower button runs out of room at 200% but not at 75%.
    const narrow = { cx: 150, width: 60, minX: 100, maxX: 200 };
    expect(glyphBesideLabel(button, narrow, small, small, 1)).not.toBeNull();
    expect(glyphBesideLabel(button, narrow, big, big, 1)).toBeNull();
  });

  it("hangs a glyph by its scaled size and skips it when that spot is no longer clear", () => {
    const anchor = { x: 500, y: 0, width: 80, height: 36 };
    const obstacle = { x: 480, y: 56, width: 100, height: 20 };
    for (const [percent, clear] of [
      [75, true],
      [200, false],
    ] as const) {
      const height = scaledGlyphHeight(16, percent);
      const point = glyphHangingBelow(anchor, height, height);
      expect(hangIsClear(glyphRect(point, height, height), [obstacle])).toBe(clear);
    }
  });

  it("makes the legend strip taller with bigger glyphs, never below its base", () => {
    expect(legendHeightFor(75)).toBe(22);
    expect(legendHeightFor(130)).toBe(27);
    expect(legendHeightFor(200)).toBe(38);
  });

  it("scales the Zones hint's room", () => {
    expect(zonesHintFits(100, 400, 75)).toBe(true);
    expect(zonesHintFits(100, 330, 200)).toBe(false);
    expect(zonesHintFits(100, 330, 100)).toBe(true);
  });
});
