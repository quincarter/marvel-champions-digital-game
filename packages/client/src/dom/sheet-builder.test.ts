import { describe, expect, it } from "vitest";
import { accent, surface } from "../tokens.js";
import { SHEET_TOKENS, SheetBuilder, sheetColor } from "./sheet-builder.js";
import { layerVariables } from "./ui-layer.js";

describe("sheetColor", () => {
  it("draws a token through the panel layer's variable for its channel, so dark mode maps it", () => {
    expect(sheetColor(surface.ink.hex, "text")).toBe(`var(--mc-text-ink, ${surface.ink.css})`);
    expect(sheetColor(accent.heroRed.hex, "fill")).toBe(`var(--mc-fill-red, ${accent.heroRed.css})`);
    expect(sheetColor(surface.inkOnHue.hex, "text")).toBe(`var(--mc-text-ink-on-hue, ${surface.inkOnHue.css})`);
  });

  it("draws a color that is no token as it is", () => {
    expect(sheetColor(0x123456, "fill")).toBe("#123456");
  });

  it("names only tokens the panel layer defines, in both schemes", () => {
    for (const scheme of ["light", "dark"] as const) {
      const vars = layerVariables(scheme, false);
      for (const name of SHEET_TOKENS.values())
        for (const channel of ["text", "fill", "line"]) expect(vars[`--mc-${channel}-${name}`], name).toBeDefined();
    }
  });
});

describe("SheetBuilder pictures and card taps", () => {
  const builder = (): SheetBuilder => new SheetBuilder({} as never, { x: 10, y: 20 }, () => false);

  it("places a picture at its rect minus the origin, on a token fill, with its hover slot and fallback word", () => {
    const b = builder();
    b.image(
      { x: 30, y: 40, width: 64, height: 90 },
      {
        src: "/card-art/01001a.png",
        fill: surface.parchment.hex,
        missing: "no scan",
        color: surface.ink.hex,
        hover: "c@0",
      },
    );
    expect(b.nodes[0]).toEqual({
      kind: "image",
      rect: { x: 20, y: 20, width: 64, height: 90 },
      src: "/card-art/01001a.png",
      fill: sheetColor(surface.parchment.hex, "fill"),
      missing: "no scan",
      color: sheetColor(surface.ink.hex, "text"),
      hover: "c@0",
    });
  });

  it("marks a tap area as inspectable (a held or right-clicked card) only when asked", () => {
    const b = builder();
    b.tap("plain", { x: 10, y: 20, width: 5, height: 5 });
    b.tap("card", { x: 10, y: 20, width: 5, height: 5 }, { inspect: true, hover: "c@1" });
    expect(b.nodes[0]).toEqual({ kind: "tap", key: "plain", rect: { x: 0, y: 0, width: 5, height: 5 } });
    expect(b.nodes[1]).toMatchObject({ key: "card", inspect: true, hover: "c@1" });
  });

  it("keeps a key and a round shape on a box, and the tab rail look on a button", () => {
    const b = builder();
    b.box({ x: 10, y: 20, width: 32, height: 32 }, { fill: surface.ink.hex, key: "badge", round: true });
    b.button({
      key: "tab:glossary",
      rect: { x: 10, y: 20, width: 100, height: 44 },
      label: "Glossary",
      look: "rail",
      selected: true,
    });
    expect(b.nodes[0]).toMatchObject({ key: "badge", round: true });
    expect(b.nodes[1]).toMatchObject({ kind: "button", look: "rail", selected: true });
  });
});
