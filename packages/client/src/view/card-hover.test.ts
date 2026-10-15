import { describe, expect, test } from "vitest";
import {
  HOVER_MARGIN,
  HOVER_BASE_LONG_SIDE,
  clipHoverRect,
  hoverCardIdAt,
  hoverKeyOfCardId,
  hoverSlotOf,
  hoverThroughHost,
  slotOfHoverKey,
  visibleRowRange,
  hoverArea,
  hoverCandidateAt,
  hoverCardSize,
  hoverPlacement,
  hoverStateLines,
  hoverWorthShowing,
  type HoverGate,
} from "./card-hover.js";
import type { Rect } from "./layout.js";

const VIEWPORT: Rect = { x: 0, y: 0, width: 1440, height: 900 };
const GATE: HoverGate = {
  formFactor: "desktop",
  mouse: true,
  scale: "3x",
  overlays: [],
  villainPhaseKey: "VillainPhase",
  dockPanel: null,
  viewport: VIEWPORT,
};

describe("hoverWorthShowing", () => {
  test("a table-sized card gets the popover; one already drawn large (the hero panel) does not", () => {
    expect(hoverWorthShowing({ x: 0, y: 0, width: 120, height: 168 })).toBe(true);
    expect(hoverWorthShowing({ x: 0, y: 0, width: 175, height: 245 })).toBe(false);
  });
});

describe("hoverArea", () => {
  test("the whole viewport on a desktop with a mouse and nothing over the table", () => {
    expect(hoverArea(GATE)).toEqual(VIEWPORT);
  });

  test.each(["phone", "phoneLandscape", "tabletPortrait", "tabletLandscape"] as const)("never on %s", (formFactor) => {
    expect(hoverArea({ ...GATE, formFactor })).toBeNull();
  });

  test("never for a touch pointer, and never with the setting off", () => {
    expect(hoverArea({ ...GATE, mouse: false })).toBeNull();
    expect(hoverArea({ ...GATE, scale: "off" })).toBeNull();
  });

  test.each(["InspectOverlay", "ChoiceOverlay", "Pause", "HoldOn", "EndTurnConfirm"])("hidden under %s", (key) => {
    expect(hoverArea({ ...GATE, overlays: [key] })).toBeNull();
  });

  test("the villain phase docked beside the table keeps hover, on the table's side of the panel", () => {
    const panel: Rect = { x: 960, y: 44, width: 480, height: 856 };
    const area = hoverArea({ ...GATE, overlays: ["VillainPhase"], dockPanel: panel });
    expect(area).toEqual({ x: 0, y: 0, width: 960, height: 900 });
  });

  test("the villain phase full screen (not docked) hides it, and so does any other overlay beside it", () => {
    expect(hoverArea({ ...GATE, overlays: ["VillainPhase"], dockPanel: null })).toBeNull();
    const panel: Rect = { x: 960, y: 44, width: 480, height: 856 };
    expect(hoverArea({ ...GATE, overlays: ["VillainPhase", "InspectOverlay"], dockPanel: panel })).toBeNull();
  });
});

describe("hoverCandidateAt", () => {
  const card: Rect = { x: 100, y: 100, width: 120, height: 168 };
  const chip: Rect = { x: 110, y: 110, width: 40, height: 20 };
  const rects = new Map<string, Rect>([
    ["card", card],
    ["chip", chip],
  ]);

  test("the card whose own tap target is the topmost thing at the point", () => {
    expect(hoverCandidateAt(115, 115, rects, card)).toBe("card");
    expect(hoverCandidateAt(115, 115, rects, chip)).toBe("chip");
  });

  test("nothing interactive there, or something else drawn on top, is no hover", () => {
    expect(hoverCandidateAt(115, 115, rects, null)).toBeNull();
    expect(hoverCandidateAt(115, 115, rects, { x: 90, y: 90, width: 400, height: 40 })).toBeNull();
  });

  test("a point outside every rect is none", () => {
    expect(hoverCandidateAt(500, 500, rects, card)).toBeNull();
  });
});

describe("hoverCardSize", () => {
  const area = VIEWPORT;
  const handCard: Rect = { x: 0, y: 0, width: 120, height: 168 };
  const heroPanel: Rect = { x: 0, y: 0, width: 175, height: 245 };
  const chip: Rect = { x: 0, y: 0, width: 30, height: 42 };

  test("every portrait card comes up at the same size, the base long side times the setting", () => {
    for (const rect of [handCard, heroPanel, chip]) {
      const size = hoverCardSize(rect, 120 / 168, "2.5x", area);
      expect(size.height).toBeCloseTo(HOVER_BASE_LONG_SIDE * 2.5);
      expect(size.width / size.height).toBeCloseTo(120 / 168);
    }
    expect(hoverCardSize(handCard, 120 / 168, "2x", area).height).toBeCloseTo(HOVER_BASE_LONG_SIDE * 2);
    expect(hoverCardSize(handCard, 120 / 168, "4x", area).height).toBeCloseTo(
      Math.min(HOVER_BASE_LONG_SIDE * 4, area.height - HOVER_MARGIN * 2),
    );
  });

  test("a sideways card's long side is its width", () => {
    const scheme: Rect = { x: 0, y: 0, width: 300, height: 214 };
    const size = hoverCardSize(scheme, 168 / 120, "2x", area);
    expect(size.width).toBeCloseTo(HOVER_BASE_LONG_SIDE * 2);
    expect(size.height).toBeCloseTo(120 * 2);
  });

  test("never larger than the area, aspect kept", () => {
    const small: Rect = { x: 0, y: 0, width: 800, height: 500 };
    const size = hoverCardSize(handCard, 120 / 168, "4x", small);
    expect(size.height).toBeLessThanOrEqual(500 - HOVER_MARGIN * 2 + 0.001);
    expect(size.width).toBeLessThanOrEqual(800 - HOVER_MARGIN * 2 + 0.001);
    expect(size.width / size.height).toBeCloseTo(120 / 168);
  });
});

describe("hoverPlacement", () => {
  const size = { width: 360, height: 504 };

  test("beside the pointer on the right, centered on it, clear of it", () => {
    const at = hoverPlacement({ x: 400, y: 450 }, size, VIEWPORT);
    expect(at.x).toBeGreaterThan(400);
    expect(at.y).toBeCloseTo(450 - 252);
  });

  test("flips to the left of the pointer at the right edge", () => {
    const at = hoverPlacement({ x: 1300, y: 450 }, size, VIEWPORT);
    expect(at.x + size.width).toBeLessThan(1300);
  });

  test("clamps at the top and bottom", () => {
    expect(hoverPlacement({ x: 400, y: 10 }, size, VIEWPORT).y).toBe(HOVER_MARGIN);
    expect(hoverPlacement({ x: 400, y: 890 }, size, VIEWPORT).y).toBe(900 - HOVER_MARGIN - size.height);
  });

  test("never leaves the area wherever the pointer is", () => {
    const area: Rect = { x: 0, y: 44, width: 960, height: 856 };
    for (let x = 0; x <= 960; x += 80) {
      for (let y = 44; y <= 900; y += 80) {
        const at = hoverPlacement({ x, y }, size, area);
        expect(at.x).toBeGreaterThanOrEqual(area.x + HOVER_MARGIN);
        expect(at.y).toBeGreaterThanOrEqual(area.y + HOVER_MARGIN);
        expect(at.x + size.width).toBeLessThanOrEqual(area.x + area.width - HOVER_MARGIN + 0.001);
        expect(at.y + size.height).toBeLessThanOrEqual(area.y + area.height - HOVER_MARGIN + 0.001);
      }
    }
  });
});

describe("hoverStateLines", () => {
  const NONE = {
    exhausted: false,
    damageNote: null,
    damage: 0,
    threatNote: null,
    threat: 0,
    counterNote: null,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    attachments: 0,
  };

  test("a plain card says nothing", () => {
    expect(hoverStateLines(NONE)).toEqual([]);
  });

  test("names every state in words", () => {
    expect(
      hoverStateLines({
        ...NONE,
        exhausted: true,
        damage: 3,
        threat: 2,
        counterNote: "1 infamy counter",
        statuses: { stunned: 1, confused: 2, tough: 0 },
        attachments: 2,
      }),
    ).toEqual(["Exhausted", "3 damage", "2 threat", "1 infamy counter", "Stunned", "Confused ×2", "2 attached"]);
  });

  test("the engine's own damage and threat sentences win over the bare count", () => {
    expect(
      hoverStateLines({ ...NONE, damage: 3, damageNote: "3/5 damage", threat: 2, threatNote: "2 threat here" }),
    ).toEqual(["3/5 damage", "2 threat here"]);
  });
});

describe("plain-card hover keys", () => {
  test("a slot key round-trips and never reads as an instance key", () => {
    const slot = hoverSlotOf("01001a", "row3");
    expect(slotOfHoverKey(hoverKeyOfCardId(slot))).toBe(slot);
    expect(slotOfHoverKey("instance-12")).toBeNull();
  });

  test("the same card in two places is two slots", () => {
    expect(hoverSlotOf("01001a", "row1")).not.toBe(hoverSlotOf("01001a", "row2"));
  });
});

describe("clipHoverRect", () => {
  const view: Rect = { x: 100, y: 100, width: 300, height: 200 };

  test("keeps only the part inside the list's window", () => {
    expect(clipHoverRect({ x: 120, y: 80, width: 100, height: 60 }, view)).toEqual({
      x: 120,
      y: 100,
      width: 100,
      height: 40,
    });
  });

  test("a card scrolled out of the window, above or below, has no rect", () => {
    expect(clipHoverRect({ x: 120, y: 20, width: 100, height: 60 }, view)).toBeNull();
    expect(clipHoverRect({ x: 120, y: 300, width: 100, height: 60 }, view)).toBeNull();
    expect(clipHoverRect({ x: 120, y: 60, width: 100, height: 40 }, view)).toBeNull();
  });
});

describe("visibleRowRange", () => {
  test("rows with any pixel in the view", () => {
    expect(visibleRowRange(0, 100, 250, 20)).toEqual({ start: 0, end: 3 });
    expect(visibleRowRange(150, 100, 250, 20)).toEqual({ start: 1, end: 4 });
  });

  test("clamps to the list and survives an empty one", () => {
    expect(visibleRowRange(1900, 100, 250, 20)).toEqual({ start: 19, end: 20 });
    expect(visibleRowRange(0, 100, 250, 0)).toEqual({ start: 0, end: 0 });
    expect(visibleRowRange(0, 0, 250, 5)).toEqual({ start: 0, end: 0 });
  });
});

describe("hoverThroughHost", () => {
  const card: Rect = { x: 50, y: 50, width: 60, height: 80 };

  test("nothing interactive under the pointer is fine", () => {
    expect(hoverThroughHost(card, null)).toBe(true);
  });

  test("a host holding the whole card is fine; a button over part of it is not", () => {
    expect(hoverThroughHost(card, { x: 0, y: 40, width: 400, height: 100 })).toBe(true);
    expect(hoverThroughHost(card, { x: 100, y: 60, width: 40, height: 30 })).toBe(false);
  });
});

describe("hoverCardIdAt", () => {
  const cell: Rect = { x: 10, y: 10, width: 100, height: 140 };
  const cards = new Map([["a@1", { ...cell, cardId: "a", through: true }]]);

  test("a through card opens over no zone and under a zone that holds it", () => {
    expect(hoverCardIdAt(50, 50, cards, null)).toBe("a@1");
    expect(hoverCardIdAt(50, 50, cards, { x: 0, y: 0, width: 400, height: 400 })).toBe("a@1");
  });

  test("not under a button that covers part of it, nor outside the card", () => {
    expect(hoverCardIdAt(50, 50, cards, { x: 40, y: 40, width: 30, height: 30 })).toBeNull();
    expect(hoverCardIdAt(300, 50, cards, null)).toBeNull();
  });

  test("a card that is its own tap target follows the shape rule", () => {
    const own = new Map([["b@1", { ...cell, cardId: "b" }]]);
    expect(hoverCardIdAt(50, 50, own, null)).toBeNull();
    expect(hoverCardIdAt(50, 50, own, cell)).toBe("b@1");
  });
});
