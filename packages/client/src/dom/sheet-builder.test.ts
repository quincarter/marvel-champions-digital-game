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

describe("SheetBuilder comic parts", () => {
  const builder = (): SheetBuilder => new SheetBuilder({} as never, { x: 10, y: 20 }, () => false);

  it("moves a notch, halftone and cropped picture by the origin, and keeps an outlined turned text and a tracked tap", () => {
    const b = builder();
    b.poly(
      [
        [10, 20],
        [30, 20],
        [20, 9],
      ],
      { fill: surface.ink.hex },
    );
    b.halftone({ x: 10, y: 20, width: 80, height: 40 }, { color: surface.ink.hex, step: 8, fade: 30, alpha: 0.85 });
    b.image(
      { x: 10, y: 20, width: 64, height: 90 },
      { src: "/v.png", fill: surface.ink.hex, cover: { x: 0.5, y: 0.3 } },
    );
    b.text(40, 50, "VS", { family: "Bangers", size: 28, weight: 400 } as never, {
      color: surface.paper.hex,
      angle: -8,
      italic: true,
      stroke: { color: surface.ink.hex, width: 5 },
    });
    b.tap("mode:epic", { x: 10, y: 20, width: 5, height: 5 }, { track: true });
    expect(b.nodes[0]).toMatchObject({
      kind: "poly",
      points: [
        [0, 0],
        [20, 0],
        [10, -11],
      ],
    });
    expect(b.nodes[1]).toMatchObject({ kind: "halftone", rect: { x: 0, y: 0, width: 80, height: 40 }, step: 8 });
    expect(b.nodes[2]).toMatchObject({ kind: "image", cover: { x: 0.5, y: 0.3 } });
    expect(b.nodes[3]).toMatchObject({ kind: "text", angle: -8, italic: true, strokeWidth: 5 });
    expect(b.nodes[4]).toMatchObject({ kind: "tap", key: "mode:epic", track: true });
  });
});

describe("SheetBuilder chips", () => {
  it("places an aspect chip at its point minus the origin", () => {
    const b = new SheetBuilder({} as never, { x: 10, y: 20 }, () => false);
    b.chip(30, 50, "justice", "Justicia", { height: 22, size: 12 });
    expect(b.nodes).toEqual([
      { kind: "chip", x: 20, y: 30, aspect: "justice", label: "Justicia", height: 22, size: 12 },
    ]);
  });
});

describe("SheetBuilder scrollFit", () => {
  const builder = (): SheetBuilder => new SheetBuilder({} as never, { x: 10, y: 20 }, () => false);

  it("takes the content height from what the build says it used, never less than the box", () => {
    const outer = builder();
    outer.scrollFit("list", { x: 30, y: 60, width: 200, height: 100 }, (inner) => {
      inner.box({ x: 30, y: 250, width: 50, height: 10 }, { fill: surface.ink.hex });
      return 300.2;
    });
    outer.scrollFit("short", { x: 30, y: 60, width: 200, height: 100 }, () => 40);
    const [tall, short] = outer.nodes;
    expect(tall).toMatchObject({ kind: "scroll", key: "list", rect: { x: 20, y: 40 }, height: 301 });
    // Parts inside sit in the region own space: `x` from the region left, `y` from its top.
    expect(tall!.kind === "scroll" && tall.nodes[0]).toMatchObject({ rect: { x: 0, y: 250 } });
    expect(short).toMatchObject({ kind: "scroll", height: 100 });
  });
});

describe("SheetBuilder kit parts", () => {
  const at = { x: 30, y: 50, width: 100, height: 40 };
  const builder = (desktop = false): SheetBuilder => new SheetBuilder({} as never, { x: 10, y: 20 }, () => desktop);

  it("builds a section header, leaving out what is not given", () => {
    const b = builder();
    b.sectionHeader(at, "Heroes", { count: "3 of 7", underline: true, level: "small", open: true, key: "h" });
    b.sectionHeader(at, "Undo");
    expect(b.nodes).toEqual([
      {
        kind: "sectionHeader",
        rect: { x: 20, y: 30, width: 100, height: 40 },
        label: "Heroes",
        count: "3 of 7",
        level: "small",
        underline: true,
        open: true,
        key: "h",
      },
      { kind: "sectionHeader", rect: { x: 20, y: 30, width: 100, height: 40 }, label: "Undo" },
    ]);
  });

  it("builds a tab rail, growing a small label on desktop only", () => {
    const tabs = [{ id: "a", label: "A" }];
    const phone = builder(false);
    phone.tabRail(at, tabs, { selected: "a", size: 9, prefix: "p:" });
    const desk = builder(true);
    desk.tabRail(at, tabs, { size: 9 });
    desk.tabRail(at, tabs);
    expect(phone.nodes[0]).toMatchObject({ kind: "tabRail", selected: "a", size: 9, prefix: "p:" });
    expect(desk.nodes[0]).toMatchObject({ size: 11 });
    expect(desk.nodes[1]).not.toHaveProperty("size");
  });

  it("builds a picture tile and a picture card", () => {
    const b = builder();
    b.pictureTile(at, { src: "/a.png", fit: "contain", focus: { x: 0.5, y: 0.2 }, dim: true, retry: "r", key: "t" });
    const model = {
      src: null,
      focusY: 0.3,
      dim: false,
      chip: "C",
      chipTone: "action" as const,
      title: "T",
      detail: "D",
      detailTone: "meta" as const,
      initial: "T",
    };
    b.pictureCard(at, model, { key: "c", hover: "01001" });
    expect(b.nodes[0]).toMatchObject({
      kind: "pictureTile",
      src: "/a.png",
      fit: "contain",
      dim: true,
      retry: "r",
      key: "t",
    });
    expect(b.nodes[1]).toEqual({
      kind: "pictureCard",
      rect: { x: 20, y: 30, width: 100, height: 40 },
      model,
      key: "c",
      hover: "01001",
    });
  });

  it("builds a list row, a search field, an article and a filter bar", () => {
    const b = builder();
    b.listRow(at, { leading: "▶", title: "S", detail: "d", open: true, active: false }, "row");
    b.search(at, { key: "s", value: "", placeholder: "P", clearLabel: "C", escapeClears: true });
    b.article(at, { key: "a", model: { title: "T", blocks: [] }, pictureMax: 400, pad: 16 });
    b.filterBar("f", at, [{ id: "x", label: "X", selected: false, width: 50 }], { sheetLabel: "Filters", rows: 2 });
    expect(b.nodes.map((n) => n.kind)).toEqual(["listRow", "search", "article", "filterBar"]);
    expect(b.nodes[1]).toMatchObject({ escapeClears: true });
    expect(b.nodes[3]).toMatchObject({ key: "f", sheetLabel: "Filters", rows: 2, rect: { x: 20, y: 30 } });
  });

  it("builds an empty state from a point or a box, and a media row", () => {
    const b = builder();
    b.emptyState({ x: 30, y: 50 }, "Nothing");
    b.emptyState(at, "Nothing", { detail: "Clear a filter", align: "center", size: 11 });
    b.mediaRow("m", at, { heading: "P", meta: "", summary: "", foot: "", badge: "", src: null, letter: "P" });
    expect(b.nodes[0]).toEqual({ kind: "emptyState", x: 20, y: 30, message: "Nothing" });
    expect(b.nodes[1]).toMatchObject({ width: 100, height: 40, detail: "Clear a filter", align: "center", size: 11 });
    expect(b.nodes[2]).toMatchObject({ kind: "mediaRow", key: "m", rect: { x: 20, y: 30 } });
  });

  it("carries a button aria name and an image dim", () => {
    const b = builder();
    b.button({ key: "plus", rect: at, label: "+", look: "secondary", type: { size: 14 }, aria: "Add" } as never);
    b.image(at, { src: "/a.png", dim: true });
    expect(b.nodes[0]).toMatchObject({ kind: "button", aria: "Add" });
    expect(b.nodes[1]).toMatchObject({ kind: "image", dim: true });
  });
});
