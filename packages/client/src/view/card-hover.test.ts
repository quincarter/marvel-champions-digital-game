import { describe, expect, test } from "vitest";
import {
  HOVER_MARGIN,
  HOVER_BASE_LONG_SIDE,
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
