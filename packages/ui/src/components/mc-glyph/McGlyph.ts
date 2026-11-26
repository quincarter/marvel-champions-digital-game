import { html, LitElement, nothing, svg, type PropertyDeclarations, type TemplateResult } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import {
  GLYPH_TAB_WIDTH,
  artDrawSize,
  artMarkup,
  layoutGlyph,
  type GlyphSpec,
  type GlyphSymbol,
  type LaidCell,
} from "./glyph-layout.js";
import { McGlyphStyles } from "./mc-glyph.styles.js";

export type McGlyphGround = "ink" | "paper";

/** The fold's durations, as the Phaser glyph's `glyphOpenness` ran them. */
export const GLYPH_COLLAPSE_MS = 140;
export const GLYPH_EXPAND_MS = 180;

let counter = 0;

/**
 * # Glyph
 * A keyboard keycap, a chord of them, or a controller button, drawn as inline SVG in the look of the client's Phaser
 * `McInputGlyph`: keys are squares with a thicker bottom edge, face buttons round discs, shoulders, triggers and system
 * buttons pills, and a button with a picture is that picture (white with an ink mark and an ink outline, recolored by
 * the theme). On an ink ground the glyph is paper-filled; on paper it is card-filled. `openness` 0 to 1 narrows and
 * fades it (a CSS transition, 140ms closing and 180ms opening, ease-out) while the mouse moves.
 *
 * It only draws: which keys to show, where and when come from the client. Sheets, buttons and later panels all use
 * this one element.
 *
 * @element mc-glyph
 * @attr still - No open / close transition (reduced motion).
 */
export class McGlyph extends LitElement {
  static override styles = [ThemeStyles, McGlyphStyles];

  static override properties: PropertyDeclarations = {
    specs: { attribute: false },
    height: { type: Number },
    openness: { type: Number },
    ground: { type: String, reflect: true },
    still: { type: Boolean, reflect: true },
  };

  declare specs: readonly GlyphSpec[];
  /** The glyph's height in px, already scaled by the hint size setting. */
  declare height: number;
  declare openness: number;
  declare ground: McGlyphGround;
  declare still: boolean;
  readonly #uid = `g${++counter}`;

  constructor() {
    super();
    this.specs = [];
    this.height = 24;
    this.openness = 1;
    this.ground = "ink";
    this.still = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Key widths depend on the font: lay out again once it is in.
    void document.fonts?.ready.then(() => {
      if (this.isConnected) this.requestUpdate();
    });
  }

  override willUpdate(): void {
    const open = Math.min(1, Math.max(0, this.openness));
    const { fullWidth } = layoutGlyph(this.specs, this.height);
    const duration = open > 0.5 ? GLYPH_EXPAND_MS : GLYPH_COLLAPSE_MS;
    this.style.transitionDuration = `${duration}ms`;
    this.style.width = `${GLYPH_TAB_WIDTH + (fullWidth - GLYPH_TAB_WIDTH) * open}px`;
    this.style.height = `${this.height}px`;
    this.style.opacity = String(open);
    this.setAttribute("role", "img");
    this.setAttribute("aria-label", this.specs.map((spec) => spec.label).join(" + "));
  }

  override render() {
    const { cells } = layoutGlyph(this.specs, this.height);
    return html`<div class="row">${cells.map((cell, index) => this.#cell(cell, index))}</div>`;
  }

  #cell(cell: LaidCell, index: number): TemplateResult {
    const { width, height } = cell;
    if (cell.art) {
      const { picture, outline, colored } = cell.art;
      const size = artDrawSize(picture, colored, this.height);
      const [x, y, w, h] = picture.box;
      // The viewBox grows by the outline on every side, so the ring drawn round the picture fits.
      const viewBox = `${x - outline} ${y - outline} ${w + outline * 2} ${h + outline * 2}`;
      const ring = outline * size.scale;
      const diagonal = ring * 0.7;
      const filter = outline
        ? `filter:${[
            [ring, 0],
            [-ring, 0],
            [0, ring],
            [0, -ring],
            [diagonal, diagonal],
            [-diagonal, diagonal],
            [diagonal, -diagonal],
            [-diagonal, -diagonal],
          ]
            .map(([dx, dy]) => `drop-shadow(${dx!.toFixed(2)}px ${dy!.toFixed(2)}px 0 var(--mc-fill-ink))`)
            .join(" ")}`
        : "";
      return html`<svg
        class="art"
        width=${width}
        height=${height}
        viewBox=${viewBox}
        style=${filter || nothing}
        aria-hidden="true"
      >
        ${unsafeSVG(artMarkup(picture.inner, `${this.#uid}-${index}`))}
      </svg>`;
    }
    const spec = cell.spec;
    const color = spec.kind === "pad" ? spec.color : undefined;
    const body =
      color !== undefined
        ? "var(--mc-fill-ink)"
        : this.ground === "ink"
          ? "var(--mc-fill-paper)"
          : "var(--mc-fill-card)";
    const ring = color !== undefined && this.ground === "ink" ? "var(--mc-line-paper)" : "var(--mc-line-ink)";
    const cx = width / 2;
    const cy = height / 2;
    const shape = cell.round
      ? svg`<circle cx=${cx} cy=${cy} r=${height / 2 - 1} fill=${body} stroke=${ring} stroke-width="2"></circle>`
      : svg`<rect x="1" y="1" width=${width - 2} height=${height - 2} fill=${body} stroke=${ring} stroke-width="2"></rect>${
          spec.kind === "key"
            ? svg`<line x1="0" y1=${height - 1} x2=${width} y2=${height - 1} stroke="var(--mc-line-ink)" stroke-width="4"></line>`
            : nothing
        }`;
    const symbol = spec.kind === "pad" ? spec.symbol : null;
    const mark = symbol
      ? this.#symbol(symbol, cx, cy, height * 0.25)
      : svg`<text x=${cx} y=${cy} font-size=${cell.fontSize} style=${color !== undefined ? `fill:${color}` : nothing}>${spec.label}</text>`;
    return html`<svg width=${width} height=${height} viewBox=${`0 0 ${width} ${height}`} aria-hidden="true">
      ${shape}${mark}
    </svg>`;
  }

  #symbol(symbol: GlyphSymbol, cx: number, cy: number, r: number) {
    switch (symbol) {
      case "cross":
        return svg`<g stroke="var(--mc-line-ink)" stroke-width="2"><line x1=${cx - r} y1=${cy - r} x2=${cx + r} y2=${cy + r}></line><line x1=${cx - r} y1=${cy + r} x2=${cx + r} y2=${cy - r}></line></g>`;
      case "circle":
        return svg`<circle cx=${cx} cy=${cy} r=${r} stroke="var(--mc-line-ink)" stroke-width="2" fill="none"></circle>`;
      case "square":
        return svg`<rect x=${cx - r} y=${cy - r} width=${r * 2} height=${r * 2} stroke="var(--mc-line-ink)" stroke-width="2" fill="none"></rect>`;
      case "triangle":
        return svg`<polygon points=${`${cx},${cy - r} ${cx + r},${cy + r * 0.8} ${cx - r},${cy + r * 0.8}`} stroke="var(--mc-line-ink)" stroke-width="2" fill="none"></polygon>`;
    }
  }
}
