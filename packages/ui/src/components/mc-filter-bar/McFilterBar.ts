import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import type { FilterBarModel } from "../../shared/filter.types.js";
import "../mc-filter-chip/mc-filter-chip.js";

/**
 * # Filter bar
 * Composes `mc-filter-chip`s with an optional sort selector and an optional button that opens a filter sheet, in one
 * wrapping row. Presentational: the client holds the filter and the sort, and answers each event with a new model.
 *
 * @element mc-filter-bar
 * @fires mc-filter - `detail.key`: a chip was tapped.
 * @fires mc-sort - `detail.value`: another sort was chosen.
 * @fires mc-filter-sheet - The filter sheet button was tapped.
 */
export class McFilterBar extends LitElement {
  static override styles = [
    ThemeStyles,
    css`
      :host {
        display: block;
      }
      .bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: stretch;
      }
      .sort {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
        font: 800 var(--mc-small-10, 10px) var(--mc-font-body);
        letter-spacing: 1.2px;
        text-transform: uppercase;
      }
      select,
      .sheet {
        min-height: 44px;
        padding: 0 12px;
        font: 800 var(--mc-chip-size, 11px) var(--mc-font-body);
        color: var(--mc-text-ink);
        background: var(--mc-fill-paper);
        border: 2px solid var(--mc-line-ink);
        border-radius: 0;
      }
      .sheet {
        display: inline-flex;
        align-items: center;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        cursor: pointer;
      }
    `,
  ];
  static override properties: PropertyDeclarations = { model: { attribute: false } };
  declare model: FilterBarModel;

  constructor() {
    super();
    this.model = { chips: [] };
  }

  #emit(name: string, detail: object = {}): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  override render() {
    const { chips, sort, sheetLabel } = this.model;
    return html`<div class="bar" role="group">
      ${chips.map(
        (chip) =>
          html`<mc-filter-chip
            .label=${chip.label}
            .count=${chip.count}
            .value=${chip.key}
            ?selected=${chip.selected}
            ?disabled=${chip.disabled ?? false}
            @mc-activate=${() => this.#emit("mc-filter", { key: chip.key })}
          ></mc-filter-chip>`,
      )}
      ${
        sheetLabel
          ? html`<span class="sheet" role="button" ${tapped(() => this.#emit("mc-filter-sheet"))}>${sheetLabel}</span>`
          : nothing
      }
      ${
        sort
          ? html`<label class="sort"
              >${sort.label}
              <select
                .value=${sort.value}
                @change=${(event: Event) => this.#emit("mc-sort", { value: (event.target as HTMLSelectElement).value })}
              >
                ${sort.options.map(
                  (option) =>
                    html`<option value=${option.value} ?selected=${option.value === sort.value}>
                      ${option.label}
                    </option>`,
                )}
              </select></label
            >`
          : nothing
      }
    </div>`;
  }
}
