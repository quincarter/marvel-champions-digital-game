import { glyphLabelShift } from "@mc/ui";
import { html, LitElement, nothing, svg, type PropertyDeclarations } from "lit";
import type { SvgOp } from "@mc/ui";
import type { TitleMenuRow } from "./mc-title-menu-button.types.js";
import { McTitleMenuButtonStyles } from "./mc-title-menu-button.styles.js";

function drawOp(op: SvgOp) {
  const fill = "fill" in op && op.fill !== undefined ? op.fill : "none";
  const stroke = "stroke" in op && op.stroke !== undefined ? op.stroke : "none";
  const sw = "sw" in op ? (op.sw ?? 1) : 1;
  switch (op.k) {
    case "rect":
      return svg`<rect x=${op.x} y=${op.y} width=${op.w} height=${op.h} fill=${fill} stroke=${stroke} stroke-width=${sw}></rect>`;
    case "circle":
      return svg`<circle cx=${op.cx} cy=${op.cy} r=${op.r} fill=${fill} stroke=${stroke} stroke-width=${sw}></circle>`;
    case "line":
      return svg`<line x1=${op.x1} y1=${op.y1} x2=${op.x2} y2=${op.y2} fill=${fill} stroke=${stroke} stroke-width=${sw}></line>`;
    case "path":
      return svg`<path d=${op.d} fill=${fill} stroke=${stroke} stroke-width=${sw}></path>`;
    default:
      return nothing;
  }
}

/**
 * # Title menu button
 * One row of the Title menu: an `mc-button` (its own focus stop, by the row key) with a platform mark and its tooltip, a
 * count badge, a small tag and a press glyph hung over it. Everything but the button is a picture that takes no press.
 *
 * @element mc-title-menu-button
 * @prop row - What the row says and how it looks (`TitleMenuRow`).
 * @attr kind - The skin (reflected from the row).
 * @attr tall - The primary height (reflected from the row).
 * @attr disabled - Unavailable (reflected from the row).
 * @fires mc-press - A tap on an enabled row, from the inner `mc-button` (keyed by its `data-stop`).
 */
export class McTitleMenuButton extends LitElement {
  static override styles = McTitleMenuButtonStyles;

  static override properties: PropertyDeclarations = {
    row: { attribute: false },
    kind: { type: String, reflect: true },
    tall: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  declare row: TitleMenuRow | null;
  declare kind: string;
  declare tall: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.row = null;
    this.kind = "secondary";
    this.tall = false;
    this.disabled = false;
  }

  protected override willUpdate(): void {
    this.kind = this.row?.kind ?? "secondary";
    this.tall = this.row?.tall ?? false;
    this.disabled = this.row?.disabled ?? false;
  }

  override render() {
    const row = this.row;
    if (!row) return nothing;
    const icon = row.icon;
    const inset = icon ? (row.tall ? 28 : 24) + 22 : 0;
    const style = [
      row.size ? `--mc-button-size:${row.size}px` : "",
      inset ? `--mc-label-inset:${inset}px` : "",
      `--mc-label-shift:${glyphLabelShift(row.glyph ?? undefined)}px`,
    ]
      .filter(Boolean)
      .join(";");
    return html`<mc-button
        data-stop=${row.key}
        style=${style}
        kind=${row.kind}
        .label=${row.label}
        ?plain=${row.plain ?? true}
        ?display=${row.display ?? false}
        ?wrap=${row.wrap ?? false}
        ?still=${row.glyph?.still ?? false}
        ?disabled=${row.disabled ?? false}
      ></mc-button>
      ${
        icon
          ? html`<div class="over icon" role="img" aria-label=${icon.label}>
                <svg viewBox=${`0 0 ${icon.grid} ${icon.grid}`} aria-hidden="true">${icon.ops.map(drawOp)}</svg>
              </div>
              <div class="tip" aria-hidden="true">${icon.label}</div>`
          : nothing
      }
      ${row.tag ? html`<div class="over tag">${row.tag}</div>` : nothing}
      ${row.badge ? html`<div class="over badge">${row.badge}</div>` : nothing}
      ${row.glyph ? html`<mc-glyph-hint .glyph=${row.glyph}></mc-glyph-hint>` : nothing}`;
  }
}
