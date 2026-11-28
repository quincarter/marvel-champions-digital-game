import { html, LitElement, nothing, svg, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { fitBlock, fitOneLine } from "../../shared/fit.js";
import type { SheetRect } from "../../shared/sheet.types.js";
import "../mc-menu-grid/mc-menu-grid.js";
import type { McMenuGrid } from "../mc-menu-grid/McMenuGrid.js";
import { McPromoPanelStyles } from "./mc-promo-panel.styles.js";
import type { PromoPanelModel } from "./mc-promo-panel.types.js";

const px = (rect: SheetRect): string =>
  `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;

/**
 * # Promo panel
 * A feature panel in the Title's comic style: an ink halftone band with a Bangers title, a pitch, an "N live" chip,
 * decoration and buttons, in a 3px ink frame. The halftone's dots grow toward the right edge, offset every other row,
 * clear of the border. The buttons are an `mc-menu-grid` and raise its `mc-activate`.
 *
 * @element mc-promo-panel
 * @attr unavailable - The feature can't be used right now (reflected): the dots, the pitch and the decoration dim.
 * @fires mc-activate - `detail.key`: one of the panel's buttons was tapped.
 */
export class McPromoPanel extends LitElement {
  static override styles = [ThemeStyles, McPromoPanelStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    unavailable: { type: Boolean, reflect: true },
  };

  declare model: PromoPanelModel | null;
  declare unavailable: boolean;

  constructor() {
    super();
    this.model = null;
    this.unavailable = false;
  }

  override willUpdate(): void {
    this.unavailable = this.model ? !this.model.available : false;
  }

  /** The element drawn for a button's key. */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector<McMenuGrid>("mc-menu-grid")?.elementOf(key) ?? null;
  }

  override updated(): void {
    const model = this.model;
    if (!model) return;
    const title = this.renderRoot.querySelector<HTMLElement>(".title");
    // A one-line title shrinks to its room, as the Phaser panel's `fitText` did.
    if (title && model.title.lines === 1) fitOneLine(title);
    const pitch = this.renderRoot.querySelector<HTMLElement>(".pitch");
    if (pitch) {
      fitBlock(pitch, 9);
    }
  }

  #halftone(band: SheetRect, available: boolean) {
    const step = 9;
    const rows = Math.floor((band.height - 8) / step);
    const cols = Math.floor((band.width - 8) / step);
    const dots: unknown[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const radius = 0.6 + 2.6 * (c / Math.max(1, cols - 1));
        dots.push(svg`<circle cx=${6 + c * step + (r % 2) * (step / 2)} cy=${6 + r * step} r=${radius}></circle>`);
      }
    }
    return html`<svg aria-hidden="true" fill="var(--mc-fill-paper)" fill-opacity=${available ? 0.2 : 0.1}>
      ${dots}
    </svg>`;
  }

  #seats(area: SheetRect, available: boolean) {
    const radius = Math.min(16, Math.floor(area.height / 2) - 4);
    const spacing = Math.min(64, (area.width - radius * 2) / 3);
    const cy = area.height / 2;
    const x0 = area.width / 2 - (spacing * 3) / 2;
    const stroke = "var(--mc-line-ink)";
    const dim = available ? 1 : 0.4;
    return html`<svg class="seats" style=${px(area)} aria-hidden="true">
      ${svg`<line x1=${x0} y1=${cy} x2=${x0 + spacing * 3} y2=${cy} stroke=${stroke} stroke-width="3" stroke-opacity=${dim}></line>`}
      ${[0, 1, 2, 3].map(
        (i) =>
          svg`<circle cx=${x0 + i * spacing} cy=${cy} r=${radius} fill=${i === 0 ? "var(--mc-fill-ink)" : "var(--mc-fill-paper)"} fill-opacity=${available ? 1 : 0.5} stroke=${stroke} stroke-width="3" stroke-opacity=${dim}></circle>`,
      )}
    </svg>`;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const live = m.live;
    return html`<div class="ground"></div>
      <div class="band" style=${px(m.band)}>${this.#halftone(m.band, m.available)}</div>
      <div class="rule" style=${`left:${m.band.x}px;top:${m.band.y + m.band.height}px;width:${m.band.width}px`}></div>
      <div
        class="title"
        data-key="title"
        style=${`${px(m.title.rect)};--size:${m.title.size}px`}
        .textContent=${m.title.text}
      ></div>
      ${
        live
          ? html`<div
              class="chip"
              style=${`top:${live.rect.y}px;height:${live.rect.height}px;max-width:${live.rect.width}px;${live.align === "left" ? `left:${live.rect.x}px` : `right:calc(100% - ${live.rect.x + live.rect.width}px)`}`}
            >
              ${live.text}
            </div>`
          : nothing
      }
      <div class="pitch" style=${`${px(m.pitch.rect)};--size:${m.pitch.size}px`}>${m.pitch.text}</div>
      ${m.seats ? this.#seats(m.seats, m.available) : nothing}
      <mc-menu-grid .items=${m.buttons}></mc-menu-grid>
      <div class="frame"></div>`;
  }
}
