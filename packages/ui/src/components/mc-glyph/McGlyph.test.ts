import { describe, expect, it } from "vitest";
import "./mc-glyph.js";
import { artMarkup, layoutGlyph, parseArt } from "./glyph-layout.js";
import type { GlyphSpec } from "../../shared/glyph.types.js";
import { GLYPH_COLLAPSE_MS, GLYPH_EXPAND_MS } from "./McGlyph.js";

const measure = (label: string, size: number): number => label.length * size * 0.5;

const art = `<svg xmlns="http://www.w3.org/2000/svg" width="24.5" height="24.5" viewBox="40.75 64.75 24.5 24.5" fill="none"><g>
<circle cx="53" cy="77" r="12" fill="BODY"/><mask id="m1"><rect fill="white" width="10" height="10"/></mask>
<path d="M0 0" fill="CUT" mask="url(#m1)"/></g></svg>`;

describe("glyph layout", () => {
  it("makes a key a square at least as wide as it is tall, and a longer one wider", () => {
    const { cells, fullWidth } = layoutGlyph([{ kind: "key", label: "I" }], 20, measure);
    expect(cells[0]!.width).toBe(20);
    expect(fullWidth).toBe(20);
    const wide = layoutGlyph([{ kind: "key", label: "Enter" }], 20, measure).cells[0]!;
    expect(wide.width).toBe(Math.ceil(5 * 11 * 0.5) + 12);
  });

  it("adds the chord gap between cells and makes a face button a disc", () => {
    const specs: GlyphSpec[] = [
      { kind: "key", label: "Hold" },
      { kind: "pad", label: "A", shape: "face" },
    ];
    const { cells, fullWidth } = layoutGlyph(specs, 24, measure);
    expect(cells[1]).toMatchObject({ width: 24, round: true });
    expect(fullWidth).toBe(cells[0]!.width + 4 + 24);
  });

  it("reads a picture's box and prefixes its ids, recoloring the placeholders", () => {
    const picture = parseArt(art);
    expect(picture.box).toEqual([40.75, 64.75, 24.5, 24.5]);
    expect(picture.inner).not.toContain("<svg");
    const marked = artMarkup(picture.inner, "g1-0");
    expect(marked).toContain('id="g1-0-m1"');
    expect(marked).toContain("url(#g1-0-m1)");
    expect(marked).toContain("fill:var(--mc-fill-card)");
    expect(marked).toContain("fill:var(--mc-fill-ink)");
    expect(marked).not.toContain("BODY");
  });

  it("keeps both a fill and a stroke placeholder on one element, in one style attribute", () => {
    const marked = artMarkup('<path d="M0 0" fill="BODY" stroke="CUT"/><g fill="CUT"></g>', "u");
    expect(marked).toContain('style="fill:var(--mc-fill-card);stroke:var(--mc-fill-ink)"');
    expect(marked).toContain('<g style="fill:var(--mc-fill-ink)">');
    expect(marked.match(/style=/g)).toHaveLength(2);
    expect(marked).not.toMatch(/(fill|stroke)="(BODY|CUT)"/);
  });

  it("draws a colored face picture an outlined disc's size, and a plain one with its outline", () => {
    const colored = layoutGlyph([{ kind: "pad", label: "A", shape: "face", art: { source: art, colored: true } }], 24);
    expect(colored.cells[0]!.width).toBeCloseTo(24, 5);
    const plain = layoutGlyph(
      [{ kind: "pad", label: "LB", shape: "shoulder", art: { source: art, colored: false } }],
      24,
    );
    expect(plain.cells[0]!.width).toBeCloseTo(24, 5);
  });
});

describe("mc-glyph", () => {
  const make = async (props: Partial<{ specs: GlyphSpec[]; openness: number; ground: "ink" | "paper" }>) => {
    const glyph = document.createElement("mc-glyph");
    glyph.specs = props.specs ?? [{ kind: "key", label: "Esc" }];
    glyph.height = 20;
    if (props.openness !== undefined) glyph.openness = props.openness;
    if (props.ground) glyph.ground = props.ground;
    document.body.append(glyph);
    await glyph.updateComplete;
    return glyph;
  };

  it("draws a keycap as inline svg with its label", async () => {
    const glyph = await make({});
    const text = glyph.shadowRoot!.querySelector("svg text");
    expect(text?.textContent).toBe("Esc");
    expect(glyph.shadowRoot!.querySelector("img")).toBeNull();
    expect(glyph.getAttribute("aria-label")).toBe("Esc");
    glyph.remove();
  });

  it("draws a pad picture inline, recolored by the theme", async () => {
    const glyph = await make({
      specs: [{ kind: "pad", label: "LB", shape: "shoulder", art: { source: art, colored: false } }],
    });
    const svg = glyph.shadowRoot!.querySelector("svg.art");
    expect(svg?.querySelector("circle")?.getAttribute("style")).toContain("--mc-fill-card");
    expect(svg?.getAttribute("style")).toContain("drop-shadow");
    glyph.remove();
  });

  it("is the full width open and a 6px tab, faded out, folded, with the Phaser glyph's timings", async () => {
    const open = await make({});
    const full = parseFloat(open.style.width);
    expect(open.style.opacity).toBe("1");
    expect(open.style.transitionDuration).toBe(`${GLYPH_EXPAND_MS}ms`);
    open.openness = 0;
    await open.updateComplete;
    expect(parseFloat(open.style.width)).toBe(6);
    expect(open.style.opacity).toBe("0");
    expect(open.style.transitionDuration).toBe(`${GLYPH_COLLAPSE_MS}ms`);
    expect(full).toBeGreaterThan(6);
    open.remove();
  });

  it("hides a folded glyph from assistive tech but keeps its label, and exposes it again when open", async () => {
    const glyph = await make({});
    expect(glyph.hasAttribute("aria-hidden")).toBe(false);
    expect(glyph.getAttribute("role")).toBe("img");
    glyph.openness = 0;
    await glyph.updateComplete;
    expect(glyph.getAttribute("aria-hidden")).toBe("true");
    expect(glyph.getAttribute("aria-label")).toBe("Esc");
    glyph.openness = 1;
    await glyph.updateComplete;
    expect(glyph.hasAttribute("aria-hidden")).toBe(false);
    glyph.remove();
  });

  it("rounds a pad pill without bundled art and keeps a keyboard key square", async () => {
    const pill = await make({ specs: [{ kind: "pad", label: "LB", shape: "shoulder" }] });
    const pillRect = pill.shadowRoot!.querySelector("svg rect")!;
    expect(parseFloat(pillRect.getAttribute("rx")!)).toBeGreaterThan(0);
    pill.remove();
    const key = await make({ specs: [{ kind: "key", label: "Esc" }] });
    expect(key.shadowRoot!.querySelector("svg rect")!.hasAttribute("rx")).toBe(false);
    key.remove();
  });

  it("gives every glyph its own picture ids", async () => {
    const specs: GlyphSpec[] = [{ kind: "pad", label: "LB", shape: "shoulder", art: { source: art, colored: false } }];
    const one = await make({ specs });
    const two = await make({ specs });
    const id = (g: HTMLElement) => g.shadowRoot!.querySelector("mask")!.id;
    expect(id(one)).not.toBe(id(two));
    one.remove();
    two.remove();
  });
});
