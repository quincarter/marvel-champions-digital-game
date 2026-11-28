import { afterEach, describe, expect, it } from "vitest";
import "../mc-glyph-hint";
import { glyphLabelShift } from "../mc-glyph-hint.types";
import type { ControlGlyph } from "../mc-glyph-hint.types";

afterEach(() => document.body.replaceChildren());

const glyph = (over: Partial<ControlGlyph> = {}): ControlGlyph => ({
  specs: [{ kind: "key", label: "Esc" }] as never,
  height: 20,
  ground: "ink",
  openness: 1,
  width: 40,
  ...over,
});

async function make(g: ControlGlyph | null | undefined) {
  const el = document.createElement("mc-glyph-hint");
  el.glyph = g;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-glyph-hint", () => {
  it("draws nothing without a glyph (touch, or no keyboard or pad in use)", async () => {
    expect((await make(null)).shadowRoot!.querySelector("mc-glyph")).toBeNull();
    expect((await make(undefined)).shadowRoot!.querySelector("mc-glyph")).toBeNull();
  });

  it("draws the glyph with its height, ground and openness, hung inside by default", async () => {
    const el = await make(glyph());
    const drawn = el.shadowRoot!.querySelector("mc-glyph")!;
    expect(drawn.height).toBe(20);
    expect(drawn.ground).toBe("ink");
    expect(drawn.openness).toBe(1);
    expect(el.getAttribute("place")).toBe("inside");
  });

  it("hangs outside to the left of a small control, and follows a new glyph", async () => {
    const el = await make(glyph({ place: "left" }));
    expect(el.getAttribute("place")).toBe("left");
    el.glyph = glyph({ height: 30 });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-glyph")!.height).toBe(30);
    expect(el.getAttribute("place")).toBe("inside");
  });
});

describe("glyphLabelShift", () => {
  it("slides the word over by half an open inside glyph and a gap, and not otherwise", () => {
    expect(glyphLabelShift(glyph())).toBe(24);
    expect(glyphLabelShift(glyph({ openness: 0 }))).toBe(0);
    expect(glyphLabelShift(glyph({ place: "left" }))).toBe(0);
    expect(glyphLabelShift(undefined)).toBe(0);
  });
});
