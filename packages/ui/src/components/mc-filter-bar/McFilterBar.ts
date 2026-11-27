import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { FilterChip } from "../../shared/filter-bar.types.js";
import "../mc-filter-chip/mc-filter-chip.js";
import { McFilterBarStyles } from "./mc-filter-bar.styles.js";

/**
 * # Filter bar
 * A wrapping row of `mc-filter-chip`s: the tags, creator and Clear that narrow a list. The chips are the widths the
 * client measured, wrapped into at most `rows` rows of `row-height` (what does not fit is left out; the search box still
 * finds it). Pressed only by a tap.
 *
 * @element mc-filter-bar
 * @attr prefix - Put before a chip's id in its `data-key` and in the reported key ("chip:").
 * @attr rows - The most rows shown (2).
 * @attr rowHeight - A row's height in px (40).
 * @attr gap - The space between chips and rows in px (8).
 * @fires mc-activate - A tap on a chip: `detail.key` is `prefix + id`, `detail.id` the chip's id.
 */
export class McFilterBar extends LitElement {
  static override styles = [ThemeStyles, McFilterBarStyles];

  static override properties: PropertyDeclarations = {
    chips: { attribute: false },
    prefix: { type: String },
    rows: { type: Number },
    rowHeight: { type: Number, attribute: "row-height" },
    gap: { type: Number },
  };

  declare chips: readonly FilterChip[];
  declare prefix: string;
  declare rows: number;
  declare rowHeight: number;
  declare gap: number;

  constructor() {
    super();
    this.chips = [];
    this.prefix = "chip:";
    this.rows = 2;
    this.rowHeight = 40;
    this.gap = 8;
  }

  /** The element drawn for a key (a chip's cell), for a screen's focus stops. */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  override render() {
    const { rowHeight, gap, rows } = this;
    return html`<div
      class="bar"
      style=${`gap:${gap}px;max-height:${rows * rowHeight + (rows - 1) * gap}px;--row:${rowHeight}px`}
    >
      ${this.chips.map(
        (chip) =>
          html`<mc-filter-chip
            class="chip"
            data-key=${this.prefix + chip.id}
            style=${`width:${chip.width}px;height:${rowHeight}px`}
            .label=${chip.label}
            .count=${chip.count}
            ?selected=${chip.selected}
            .mark=${chip.mark ?? true}
            @mc-press=${(event: Event) => {
              event.stopPropagation();
              this.dispatchEvent(
                new CustomEvent("mc-activate", {
                  detail: { key: this.prefix + chip.id, id: chip.id },
                  bubbles: true,
                  composed: true,
                }),
              );
            }}
          ></mc-filter-chip>`,
      )}
    </div>`;
  }
}
