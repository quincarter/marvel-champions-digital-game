import { describe, expect, it } from "vitest";
import {
  HERO_CAPTION_HEIGHT,
  cardStampOf,
  heroCardModelOf,
  pairBracketsOf,
  pairPillRect,
  seatFrameOf,
  seatLabelOf,
  type HeroCardWords,
} from "./seats-panel-model.js";

const words = (over: Partial<HeroCardWords> = {}): HeroCardWords => ({
  title: "Spider-Man",
  subtitle: "Precon · Peter Parker",
  warning: null,
  stamps: [{ label: "Justice", fill: 0xf4c20d, ink: 0x14110d }],
  tag: null,
  plate: null,
  selected: false,
  ...over,
});

describe("heroCardModelOf", () => {
  it("shows the caption in the meta tone, the stamps as CSS colors and a display title", () => {
    const model = heroCardModelOf(words(), "S");
    expect(model.detail).toBe("Precon · Peter Parker");
    expect(model.detailTone).toBe("meta");
    expect(model.stamps).toEqual([{ label: "Justice", fill: "#f4c20d", ink: "#14110d" }]);
    expect(model.titleDisplay).toBe(true);
    expect(model.titleSize).toBe(22);
    expect(model.detailLines).toBe(2);
    expect(model.captionHeight).toBe(HERO_CAPTION_HEIGHT);
    expect(model.chip).toBe("");
    expect(model.initial).toBe("S");
  });

  it("lets a warning stand in for the caption, in the caution tone", () => {
    const model = heroCardModelOf(words({ warning: "Locked · or 40 pts" }), "S");
    expect(model.detail).toBe("Locked · or 40 pts");
    expect(model.detailTone).toBe("caution");
  });

  it("carries the tag, the team-up plate and the chosen frame only when there is one", () => {
    expect(heroCardModelOf(words(), "S")).not.toHaveProperty("tag");
    expect(heroCardModelOf(words(), "S")).not.toHaveProperty("plate");
    const model = heroCardModelOf(words({ tag: "SEAT 2", plate: "Team-Up with Phoenix", selected: true }), "S");
    expect(model.tag).toBe("SEAT 2");
    expect(model.plate).toBe("Team-Up with Phoenix");
    expect(model.selected).toBe(true);
  });
});

describe("cardStampOf", () => {
  it("pads a color to six hex digits", () => {
    expect(cardStampOf({ label: "Basic", fill: 0x00ff, ink: 0x0 })).toEqual({
      label: "Basic",
      fill: "#0000ff",
      ink: "#000000",
    });
  });
});

describe("seatFrameOf", () => {
  it("frames a filled seat by whether it is the active one", () => {
    expect(seatFrameOf({ active: true, filled: true }, true)).toBe("activeFilled");
    expect(seatFrameOf({ active: false, filled: true }, true)).toBe("filled");
  });
  it("keeps the active empty seat reading as active, and dims an empty seat that cannot be reached yet", () => {
    expect(seatFrameOf({ active: true, filled: false }, true)).toBe("activeEmpty");
    expect(seatFrameOf({ active: false, filled: false }, true)).toBe("empty");
    expect(seatFrameOf({ active: false, filled: false }, false)).toBe("locked");
  });
});

describe("seatLabelOf", () => {
  const w = { seat: "SEAT 1", picking: "SEAT 1 · PICKING", you: " · YOU" };
  it("adds YOU to the first filled seat where there is room, never to another", () => {
    expect(seatLabelOf(w, "activeFilled", 0)).toBe("SEAT 1 · YOU");
    expect(seatLabelOf(w, "filled", 0, false)).toBe("SEAT 1");
    expect(seatLabelOf({ ...w, seat: "SEAT 2" }, "filled", 1)).toBe("SEAT 2");
  });
  it("says picking for the active empty seat", () => {
    expect(seatLabelOf(w, "activeEmpty", 0)).toBe("SEAT 1 · PICKING");
  });
});

describe("Team-Up brackets", () => {
  const seats = [0, 1, 2, 3].map((i) => ({ x: 24 + i * 100, y: 80, width: 94, height: 115 }));
  const strip = { x: 24, y: 203, width: 394, height: 44 };

  it("runs a bracket per pair that fits the strip, between the partners' centers", () => {
    const brackets = pairBracketsOf(strip, [{ seats: [1, 3] }, { seats: [2, 4] }, { seats: [1, 2] }], seats, 22);
    expect(brackets).toHaveLength(2);
    expect(brackets[0]).toEqual({ xs: [71, 271], y: 214 });
    expect(brackets[1]!.y).toBe(236);
  });

  it("keeps the pill inside the strip, centered on the bracket where it can be", () => {
    const bracket = { xs: [71, 271] as const, y: 214 };
    const pill = pairPillRect(strip, bracket, 100, 20, true);
    expect(pill.width).toBe(138);
    expect(pill.x).toBe(171 - 69);
    const edge = pairPillRect(strip, { xs: [30, 40], y: 214 }, 100, 20, false);
    expect(edge.x).toBe(strip.x);
    const wide = pairPillRect(strip, bracket, 900, 20, true);
    expect(wide.width).toBe(strip.width);
  });
});
