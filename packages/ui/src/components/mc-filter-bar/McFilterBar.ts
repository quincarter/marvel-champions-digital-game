import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "./mc-filter-chip.js";
import type { McFilterBarModel, McFilterChipModel } from "./mc-filter-bar.types.js";
import { McFilterBarStyles } from "./mc-filter-bar.styles.js";

/**
 * # Filter bar
 * The row of quick filters over a list: toggle chips with counts, an optional Filters button that folds the chips away
 * until it is pressed, and an optional sort chip that steps through its options. Built from `mc-filter-chip` cells, so
 * every press follows the tap rule. The bar only reports presses; what a filter keeps or drops is the client own
 * (`view/roster-filter.ts`, `view/pool-query.ts`).
 *
 * @element mc-filter-bar
 * @prop model - The chips, Filters button and sort (`McFilterBarModel`).
 * @attr row - The row height in px (28 on a desktop, 44 as a touch target).
 * @fires mc-activate - A press, as the sheet keys it: `detail.key` is `chip:<id>`, `filters` or `sort` (with `detail.id`
 *   the next sort option); `detail.id` is the chip id for a chip.
 */
export class McFilterBar extends LitElement {
  static override styles = [ThemeStyles, McFilterBarStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    row: { type: Number },
  };

  declare model: McFilterBarModel | null;
  declare row: number;

  constructor() {
    super();
    this.model = null;
    this.row = 28;
  }

  #emit(key: string, id?: string): void {
    this.dispatchEvent(
      new CustomEvent("mc-activate", {
        detail: { key, ...(id !== undefined ? { id } : {}) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #onChip = (event: Event): void => {
    event.stopPropagation();
    const id = (event as CustomEvent<{ id: string }>).detail.id;
    this.#emit(`chip:${id}`, id);
  };

  override render() {
    const m = this.model;
    if (!m) return nothing;
    this.style.setProperty("--bar-row", `${this.row}px`);
    this.style.setProperty("--bar-justify", m.align === "end" ? "flex-end" : "flex-start");
    const showChips = m.filters === undefined || m.filters.open;
    const filtersChip: McFilterChipModel | null = m.filters
      ? {
          id: "filters",
          label: m.filters.active ? `${m.filters.label} ${m.filters.active}` : m.filters.label,
          selected: m.filters.open,
        }
      : null;
    return html`
      ${
        filtersChip
          ? html`<span class="cell" data-key="filters"
              ><mc-filter-chip
                .model=${filtersChip}
                @mc-chip=${(event: Event) => {
                  event.stopPropagation();
                  this.#emit("filters");
                }}
              ></mc-filter-chip
            ></span>`
          : nothing
      }
      ${
        showChips
          ? repeat(
              m.chips,
              (chip) => chip.id,
              (chip) =>
                html`<span class="cell" data-key=${`chip:${chip.id}`}
                  ><mc-filter-chip .model=${chip} @mc-chip=${this.#onChip}></mc-filter-chip
                ></span>`,
            )
          : nothing
      }
      ${
        m.sort
          ? html`<span class="cell" data-key="sort"
              ><mc-filter-chip
                .model=${{ id: "sort", label: m.sort.label, selected: false }}
                @mc-chip=${(event: Event) => {
                  event.stopPropagation();
                  this.#emit("sort", m.sort!.nextId);
                }}
              ></mc-filter-chip
            ></span>`
          : nothing
      }
    `;
  }
}
