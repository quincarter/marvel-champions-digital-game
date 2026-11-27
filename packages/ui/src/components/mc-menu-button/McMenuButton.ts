import { html, LitElement, nothing, svg, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { SvgOp } from "../../shared/sheet.types.js";
import "../mc-button/mc-button.js";
import "../mc-glyph/mc-glyph.js";
import { GLYPH_COLLAPSE_MS, GLYPH_EXPAND_MS } from "../mc-glyph/McGlyph.js";
import { McMenuButtonStyles } from "./mc-menu-button.styles.js";
import type { MenuButton } from "./mc-menu-button.types.js";

/**
 * # Menu button
 * One row of a menu: an `mc-button` (the client's `McButton` skins) with the things a menu row wears over it: an icon
 * with its tooltip, a count badge on the top right corner, a small tag at the right end, a key or pad glyph beside the
 * word, a label that wraps. Everything but the button is a picture that takes no press. Presentational: the model comes
 * from the client, already translated.
 *
 * @element mc-menu-button
 * @attr kind - The button's skin (reflected from the model: primary | secondary | quiet | onInk | rail).
 * @attr disabled - Unavailable (reflected).
 * @fires mc-press - A tap on an enabled button (from the inner `mc-button`).
 */
export class McMenuButton extends LitElement {
  static override styles = [ThemeStyles, McMenuButtonStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    kind: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  declare model: MenuButton | null;
  declare kind: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.model = null;
    this.kind = "secondary";
    this.disabled = false;
  }

  override willUpdate(): void {
    this.kind = this.model?.kind ?? "secondary";
    this.disabled = this.model?.disabled ?? false;
  }

  #op(op: SvgOp): unknown {
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

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const { icon, glyph } = m;
    const style = [
      m.size ? `--mc-button-size:${m.size}px` : "",
      m.labelInset ? `--mc-label-inset:${m.labelInset}px` : "",
      `--mc-label-shift:${m.labelShift ?? 0}px`,
      `--mc-label-ms:${m.labelShift ? GLYPH_EXPAND_MS : GLYPH_COLLAPSE_MS}ms`,
    ]
      .filter(Boolean)
      .join(";");
    return html`<mc-button
        style=${style}
        kind=${m.kind}
        .label=${m.label}
        ?plain=${m.plain ?? false}
        ?display=${m.display ?? false}
        ?wrap=${m.wrap ?? false}
        ?still=${m.still ?? false}
        ?disabled=${m.disabled ?? false}
        aria-keyshortcuts=${m.keyshortcuts ?? nothing}
      ></mc-button>
      ${
        icon
          ? html`<div
                class="over icon"
                role="img"
                aria-label=${icon.label}
                style=${`left:${icon.rect.x}px;top:${icon.rect.y}px;width:${icon.rect.width}px;height:${icon.rect.height}px`}
              >
                <svg viewBox=${`0 0 ${icon.grid} ${icon.grid}`} aria-hidden="true">
                  ${icon.ops.map((op) => this.#op(op))}
                </svg>
              </div>
              <div class="tip" style=${`left:${icon.rect.x}px`} aria-hidden="true">${icon.label}</div>`
          : nothing
      }
      ${
        m.tag
          ? html`<div class="over tag" style=${`right:12px;top:${(m.rect.height - 16) / 2}px`}>${m.tag}</div>`
          : nothing
      }
      ${m.badge ? html`<div class="over badge" style="right:-6px;top:-6px">${m.badge}</div>` : nothing}
      ${
        glyph
          ? html`<mc-glyph
              style=${`left:${glyph.x}px;top:${glyph.y - glyph.height / 2}px`}
              .specs=${glyph.specs}
              .height=${glyph.height}
              .ground=${glyph.ground}
              .openness=${glyph.openness}
              ?still=${glyph.still ?? false}
            ></mc-glyph>`
          : nothing
      }`;
  }
}
