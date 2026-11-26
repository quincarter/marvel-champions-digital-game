import { html, LitElement, nothing, svg, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import "../mc-button/mc-button.js";
import "../mc-glyph/mc-glyph.js";
import type { GlyphSpec } from "../mc-glyph/glyph-layout.js";
import { GLYPH_COLLAPSE_MS, GLYPH_EXPAND_MS, type McGlyphGround } from "../mc-glyph/McGlyph.js";
import type { McButtonKind } from "../mc-button/McButton.js";
import { McSheetStyles } from "./mc-sheet.styles.js";

/** A box in the sheet's own coordinates (from its top left). */
export interface SheetRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A filled and/or outlined rectangle. A stroke is centered on the box's edge, as Phaser strokes it. */
export interface SheetBox {
  readonly kind: "box";
  /** A key the e2e and focus code can find the box by (a card whose place the focus ring follows). */
  readonly key?: string;
  readonly rect: SheetRect;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly dashed?: boolean;
  readonly opacity?: number;
  /** A circle (a lesson's number badge): the box is square and fully rounded. */
  readonly round?: boolean;
}

/** The table felt's dot grid over a box. */
export interface SheetDots {
  readonly kind: "dots";
  readonly rect: SheetRect;
  readonly color: string;
  readonly spacing: number;
  readonly radius: number;
  readonly opacity: number;
}

/** A label or a paragraph. `anchorX` / `anchorY` say which point of it sits at `x`, `y` (Phaser's origin). */
export interface SheetText {
  readonly kind: "text";
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly font: "display" | "body" | "mono";
  /** In px; a size of 12 or less grows on desktop when `small` is set (the client's desktop type bump). */
  readonly size: number;
  readonly small?: boolean;
  readonly weight: number;
  readonly color: string;
  readonly opacity?: number;
  readonly letterSpacing?: number;
  /** Line height in px (wrapped text). */
  readonly lineHeight?: number;
  readonly uppercase?: boolean;
  readonly align?: "left" | "center" | "right";
  readonly anchorX?: number;
  readonly anchorY?: number;
  /** Wraps at this width. */
  readonly wrapWidth?: number;
  /** One line that shrinks to fit this width, as Phaser's `fitText` does. */
  readonly fitWidth?: number;
  /** A wrapped text cut with an ellipsis after this many lines. */
  readonly maxLines?: number;
  /** A key the e2e and focus code can find the text by. */
  readonly key?: string;
  /** Letter ranges (`start` to `end`, exclusive) marked as a search match: a band behind them and a line under. */
  readonly marks?: readonly { readonly start: number; readonly end: number }[];
  readonly italic?: boolean;
  /** Turns the text about its anchor point, in degrees (Phaser's `setAngle`). */
  readonly angle?: number;
  /** An outline round the letters, drawn behind the fill (Phaser's `setStroke`): its colour and width in px. */
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
}

/** A button: the client's `McButton` skins, pressed by a tap. */
export interface SheetButton {
  readonly kind: "button";
  readonly key: string;
  readonly rect: SheetRect;
  readonly label: string;
  readonly look: McButtonKind;
  readonly selected?: boolean;
  readonly disabled?: string | true;
  readonly framed?: boolean;
  /** A Bangers label. */
  readonly display?: boolean;
  /** A label in its own case with no tracking (a row title). */
  readonly plain?: boolean;
  /** The label's px size. */
  readonly size?: number;
  /** How far the label slides right to make room for a glyph beside it (px; eased when it changes). */
  readonly labelShift?: number;
  /** No label slide (reduced motion). */
  readonly still?: boolean;
}

/** A key or controller-button glyph (`mc-glyph`) at its left edge `x`, vertically centered on `y`. Never takes a press. */
export interface SheetGlyph {
  readonly kind: "glyph";
  readonly x: number;
  readonly y: number;
  readonly specs: readonly GlyphSpec[];
  /** The glyph's height in px, already scaled by the hint size setting. */
  readonly height: number;
  readonly ground: McGlyphGround;
  /** 0 (folded away) to 1 (open). */
  readonly openness: number;
  /** No fold animation (reduced motion). */
  readonly still?: boolean;
  readonly key?: string;
}

/**
 * An invisible area a tap presses (a card, a row). With `inspect`, a press-and-hold or a right-click also raises
 * `mc-inspect` (a card's "look at this"), and the release that ended a hold is not a tap.
 */
export interface SheetTap {
  readonly kind: "tap";
  readonly key: string;
  readonly rect: SheetRect;
  readonly inspect?: boolean;
  /** Names the card the area shows (the client's card hover popover reads it). */
  readonly hover?: string;
  /** A mouse moving over or off the area raises `mc-hover` (a desktop shows a box's info before it is picked). */
  readonly track?: boolean;
}

/**
 * A picture (a card scan) in a box: the whole picture fitted inside it, on `fill`. It loads when it scrolls near
 * (`loading="lazy"`). With no `src`, or one that fails to load, the box says `missing` instead, as the client's
 * card tiles say "no scan". `hover` names the card the picture shows (the client's card hover popover reads it).
 */
export interface SheetImage {
  readonly kind: "image";
  readonly rect: SheetRect;
  readonly src: string | null;
  readonly fill?: string;
  /** What the box says while there is no picture (a missing scan), already translated. */
  readonly missing?: string;
  /** The text colour of `missing`. */
  readonly color?: string;
  readonly hover?: string;
  readonly key?: string;
  /** Fills the box, cropped (never stretched) around this focal point, 0 to 1 each way, instead of fitting whole. */
  readonly cover?: { readonly x: number; readonly y: number };
}

/** Ink dots thickening toward the foot of a box, the way the comic pages shade a panel (a game mode box's art). */
export interface SheetHalftone {
  readonly kind: "halftone";
  readonly rect: SheetRect;
  readonly color: string;
  /** The grid's spacing in px. */
  readonly step: number;
  /** How far up from the foot the dots reach, in px. */
  readonly fade: number;
  readonly opacity: number;
}

/** A filled polygon or an open line (a notch pointing at a box), its points in the sheet's own coordinates. */
export interface SheetPoly {
  readonly kind: "poly";
  readonly points: readonly (readonly [number, number])[];
  /** Filled and closed (a polygon); left out, it is an open line, only stroked. */
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
}

/** A scrolling region: its own nodes, laid out in its content space (`height` tall). */
export interface SheetScroll {
  readonly kind: "scroll";
  readonly key: string;
  readonly rect: SheetRect;
  readonly height: number;
  readonly nodes: readonly SheetNode[];
}

export type SheetNode =
  | SheetBox
  | SheetDots
  | SheetText
  | SheetButton
  | SheetGlyph
  | SheetImage
  | SheetHalftone
  | SheetPoly
  | SheetTap
  | SheetScroll;

/**
 * A part's identity across redraws: its key when it has one (a button, a tap area, a scroller), so a press in flight or a
 * list's scroll stays with its part when parts before it come and go; else its kind and place in the list.
 */
const keyOf = (node: SheetNode, index: number): string =>
  "key" in node && node.key !== undefined ? `${node.kind}:key:${node.key}` : `${node.kind}:${index}`;

const px = (rect: SheetRect): string =>
  `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;

/**
 * # Sheet
 * A panel drawn from positioned parts: boxes, the dot grid, text, buttons, tap areas and scrolling regions, each at
 * the place the client's tested layout gives it. It is how a Phaser screen made of hand-placed parts (Pause, the
 * menus) moves to the DOM with the same look: the scene builds the same parts it drew before
 * (`client/src/dom/sheet-builder.ts`), and this draws them as HTML. Every press is a tap.
 *
 * @element mc-sheet
 * @fires mc-activate - `detail.key`: a button or tap area was tapped.
 * @fires mc-inspect - `detail.key`: a tap area with `inspect` was held or right-clicked.
 * @fires mc-hover - `detail.key`, `detail.over`: a mouse moved onto or off a tap area with `track`.
 */
export class McSheet extends LitElement {
  static override styles = [ThemeStyles, McSheetStyles];

  static override properties: PropertyDeclarations = {
    nodes: { attribute: false },
  };

  declare nodes: readonly SheetNode[];
  /** The pictures that failed to load, so their boxes say `missing` (and keep saying it across redraws). */
  readonly #failed = new Set<string>();

  constructor() {
    super();
    this.nodes = [];
  }

  /** The element drawn for a key (a button, a tap area, a keyed text, a scroll region). */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  #activate(key: string): void {
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key }, bubbles: true, composed: true }));
  }

  #hover(key: string, over: boolean, event: PointerEvent): void {
    if (event.pointerType !== "mouse") return;
    this.dispatchEvent(new CustomEvent("mc-hover", { detail: { key, over }, bubbles: true, composed: true }));
  }

  #inspect(key: string): void {
    this.dispatchEvent(new CustomEvent("mc-inspect", { detail: { key }, bubbles: true, composed: true }));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void document.fonts?.ready.then(() => this.requestUpdate());
  }

  override updated(): void {
    // One-line texts shrink to fit their width, as Phaser's `fitText` does: smaller down to the floor, then without a
    // closing parenthetical ("Spider-Man (Peter Parker)"), then cut with an ellipsis.
    for (const text of this.renderRoot.querySelectorAll<HTMLElement>("[data-fit]")) {
      // Marked text is a run of Lit-owned fragments and `mark` elements: never write into those. It only shrinks by
      // font size, and the CSS `text-overflow: ellipsis` on the span does any cutting.
      const words =
        text.childElementCount > 0
          ? undefined
          : [...text.childNodes].find((node): node is Text => node.nodeType === Node.TEXT_NODE);
      const full = text.dataset.full ?? words?.data ?? "";
      if (words) words.data = full;
      text.style.fontSize = text.dataset.size ?? "";
      const width = Number(text.dataset.fit);
      const style = getComputedStyle(text);
      let size = parseFloat(style.fontSize);
      // The client's caption floor (8px, grown on desktop like every small size) before the text is cut short.
      const floor = parseFloat(style.getPropertyValue("--mc-small-8")) || 8;
      while (text.scrollWidth > width && size > floor) {
        size = Math.max(floor, size - 0.5);
        text.style.fontSize = `${size}px`;
      }
      if (!words || text.scrollWidth <= width) continue;
      let shown = full;
      const asideless = full.replace(/\s*\([^)]*\)\s*$/, "");
      if (asideless !== full && asideless !== "") {
        shown = asideless;
        words.data = shown;
        if (text.scrollWidth <= width) continue;
      }
      let short = 1;
      let long = shown.length - 1;
      let best = 1;
      while (short <= long) {
        const length = (short + long) >> 1;
        words.data = `${shown.slice(0, length).trimEnd()}…`;
        if (text.scrollWidth <= width) {
          best = length;
          short = length + 1;
        } else long = length - 1;
      }
      words.data = `${shown.slice(0, best).trimEnd()}…`;
    }
  }

  override render() {
    return html`${repeat(this.nodes, keyOf, (node) => this.#node(node))}`;
  }

  /** `text` with its marked ranges in `mark` elements, written without whitespace between the parts. */
  #marked(text: string, marks: readonly { readonly start: number; readonly end: number }[]): unknown[] {
    const parts: unknown[] = [];
    let at = 0;
    for (const { start, end } of marks) {
      if (start > at) parts.push(text.slice(at, start));
      parts.push(html`<mark>${text.slice(start, end)}</mark>`);
      at = end;
    }
    if (at < text.length) parts.push(text.slice(at));
    return parts;
  }

  #node(node: SheetNode): unknown {
    switch (node.kind) {
      case "box": {
        const width = node.strokeWidth ?? 0;
        const style = [
          px(node.rect),
          node.fill ? `background:${node.fill}` : "",
          node.stroke && width > 0
            ? `outline:${width}px ${node.dashed ? "dashed" : "solid"} ${node.stroke};outline-offset:${-width / 2}px`
            : "",
          node.opacity !== undefined ? `opacity:${node.opacity}` : "",
          node.round ? "border-radius:50%" : "",
        ].join(";");
        return html`<div class="part" data-key=${node.key ?? nothing} style=${style}></div>`;
      }
      case "dots": {
        const id = `dots-${node.spacing}-${node.radius}-${node.color.replace(/[^a-z0-9]/gi, "")}`;
        return html`<svg class="part" style=${`${px(node.rect)};opacity:${node.opacity}`} aria-hidden="true">
          ${svg`<defs><pattern id=${id} width=${node.spacing} height=${node.spacing} patternUnits="userSpaceOnUse">
            <circle cx=${node.spacing / 2} cy=${node.spacing / 2} r=${node.radius} fill=${node.color}></circle>
          </pattern></defs><rect width="100%" height="100%" fill=${`url(#${id})`}></rect>`}
        </svg>`;
      }
      case "text": {
        const size =
          node.small && node.size <= 12 ? `var(--mc-small-${Math.round(node.size)}, ${node.size}px)` : `${node.size}px`;
        const width =
          node.wrapWidth !== undefined
            ? `width:${node.wrapWidth}px;white-space:pre-wrap;overflow-wrap:anywhere`
            : "white-space:pre";
        const style = [
          `left:${node.x}px`,
          `top:${node.y}px`,
          `transform:translate(${-(node.anchorX ?? 0) * 100}%, ${-(node.anchorY ?? 0) * 100}%)${node.angle ? ` rotate(${node.angle}deg)` : ""}`,
          node.angle ? `transform-origin:${(node.anchorX ?? 0) * 100}% ${(node.anchorY ?? 0) * 100}%` : "",
          node.italic ? "font-style:italic" : "",
          node.strokeColor && node.strokeWidth
            ? `-webkit-text-stroke:${node.strokeWidth}px ${node.strokeColor};paint-order:stroke fill`
            : "",
          `font-family:var(--mc-font-${node.font})`,
          `font-size:${size}`,
          `font-weight:${node.weight}`,
          `color:${node.color}`,
          node.opacity !== undefined ? `opacity:${node.opacity}` : "",
          node.letterSpacing ? `letter-spacing:${node.letterSpacing}px` : "",
          node.lineHeight ? `line-height:${node.lineHeight}px` : "",
          node.uppercase ? "text-transform:uppercase" : "",
          node.align ? `text-align:${node.align}` : "",
          width,
          node.fitWidth !== undefined
            ? `max-width:${node.fitWidth}px;overflow:hidden${node.marks?.length ? ";text-overflow:ellipsis" : ""}`
            : "",
          node.maxLines
            ? `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${node.maxLines};overflow:hidden`
            : "",
        ].join(";");
        return html`<span
          class="part text"
          data-key=${node.key ?? nothing}
          data-fit=${node.fitWidth ?? nothing}
          data-size=${node.fitWidth !== undefined ? size : nothing}
          data-full=${node.fitWidth !== undefined ? node.text : nothing}
          style=${style}
          >${node.marks?.length ? this.#marked(node.text, node.marks) : node.text}</span
        >`;
      }
      case "button":
        return html`<mc-button
          class="part"
          data-key=${node.key}
          style=${`${px(node.rect)}${node.size ? `;--mc-button-size:${node.size}px` : ""};--mc-label-shift:${node.labelShift ?? 0}px;--mc-label-ms:${node.labelShift ? GLYPH_EXPAND_MS : GLYPH_COLLAPSE_MS}ms`}
          kind=${node.look}
          .label=${node.label}
          ?selected=${node.selected ?? false}
          ?framed=${node.framed ?? false}
          ?display=${node.display ?? false}
          ?plain=${node.plain ?? false}
          ?still=${node.still ?? false}
          ?disabled=${node.disabled !== undefined}
          .reason=${typeof node.disabled === "string" ? node.disabled : ""}
          @mc-press=${() => this.#activate(node.key)}
        ></mc-button>`;
      case "glyph":
        return html`<mc-glyph
          class="part"
          data-key=${node.key ?? nothing}
          style=${`left:${node.x}px;top:${node.y - node.height / 2}px`}
          .specs=${node.specs}
          .height=${node.height}
          .ground=${node.ground}
          .openness=${node.openness}
          ?still=${node.still ?? false}
        ></mc-glyph>`;
      case "image": {
        const gone = node.src === null || this.#failed.has(node.src);
        const style = [
          px(node.rect),
          node.fill ? `background:${node.fill}` : "",
          node.color ? `color:${node.color}` : "",
        ].join(";");
        return html`<div
          class="part image"
          data-key=${node.key ?? nothing}
          data-hover=${node.hover ?? nothing}
          style=${style}
        >
          ${
            gone
              ? node.missing
                ? html`<span class="missing">${node.missing}</span>`
                : nothing
              : html`<img
                  src=${node.src!}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style=${node.cover ? `object-fit:cover;object-position:${node.cover.x * 100}% ${node.cover.y * 100}%` : nothing}
                  draggable="false"
                  @error=${() => {
                    this.#failed.add(node.src!);
                    this.requestUpdate();
                  }}
                />`
          }
        </div>`;
      }
      case "halftone": {
        const circles: { x: number; y: number; r: number }[] = [];
        const { step, fade } = node;
        for (let row = 0; row * step < fade; row++) {
          const y = node.rect.height - row * step - step / 2;
          const r = Math.max(0.6, (step / 2) * (1 - (row * step) / fade) * 0.95);
          for (let x = (row % 2 ? step / 2 : 0) + step / 2; x < node.rect.width; x += step) circles.push({ x, y, r });
        }
        return html`<svg class="part" style=${px(node.rect)} aria-hidden="true">
          ${circles.map(
            ({ x, y, r }) =>
              svg`<circle cx=${x} cy=${y} r=${r} fill=${node.color} fill-opacity=${node.opacity}></circle>`,
          )}
        </svg>`;
      }
      case "poly": {
        const points = node.points.map(([x, y]) => `${x},${y}`).join(" ");
        const shape = node.fill
          ? svg`<polygon points=${points} fill=${node.fill} stroke=${node.stroke ?? "none"} stroke-width=${node.strokeWidth ?? 0}></polygon>`
          : svg`<polyline points=${points} fill="none" stroke=${node.stroke ?? "none"} stroke-width=${node.strokeWidth ?? 0}></polyline>`;
        return html`<svg
          class="part poly"
          style="left:0;top:0;width:1px;height:1px;overflow:visible"
          aria-hidden="true"
        >
          ${shape}
        </svg>`;
      }
      case "tap":
        return html`<div
          class="part tap"
          data-key=${node.key}
          data-hover=${node.hover ?? nothing}
          style=${px(node.rect)}
          @pointerenter=${node.track ? (event: PointerEvent) => this.#hover(node.key, true, event) : nothing}
          @pointerleave=${node.track ? (event: PointerEvent) => this.#hover(node.key, false, event) : nothing}
          ${tapped(() => this.#activate(node.key), node.inspect ? () => this.#inspect(node.key) : undefined)}
        ></div>`;
      case "scroll":
        return html`<div class="part scroller" data-key=${node.key} style=${px(node.rect)}>
          <div class="content" style=${`height:${node.height}px`}>
            ${repeat(node.nodes, keyOf, (child) => this.#node(child))}
          </div>
        </div>`;
    }
  }
}
