import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type FilterChip, type McSearchField } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { McModFindersStyles } from "./mc-mod-finders.styles.js";
import type { McModFindersProps, ModFindersSearch } from "./mc-mod-finders.types.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";

/**
 * # Mod Store finders
 * The controls over a tab's grid (issue #734): the search box (a real input) and the sort, a row of chips (the creator
 * picked on Credits, then the tab's tags, the most used first) with Clear at its end, and the count of what shows. A
 * phone keeps one row of chips and its search behind the magnifier (`mc-mod-tabs`).
 *
 * The search box's own `mc-search` and `mc-search-focus` pass through untouched, so the region's guard can restore a field
 * the scene refused.
 *
 * @element mc-mod-finders
 * @fires mc-mod-store - `{ type: "sort" }`, `{ type: "chip", id }` and `{ type: "clear" }`.
 */
export class McModFinders extends ModStoreElement implements McModFindersProps {
  static override styles = [ThemeStyles, McModFindersStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    search: { attribute: false },
    sortLabel: { type: String, attribute: "sort-label" },
    chips: { attribute: false },
    clearLabel: { type: String, attribute: "clear-label" },
    countText: { type: String, attribute: "count-text" },
  };

  declare size: ModStoreSize;
  declare search: ModFindersSearch;
  declare sortLabel: string;
  declare chips: readonly FilterChip[];
  declare clearLabel: string;
  declare countText: string;

  constructor() {
    super();
    this.size = "wide";
    this.search = { value: "", placeholder: "", clearLabel: "" };
    this.sortLabel = "";
    this.chips = [];
    this.clearLabel = "";
    this.countText = "";
  }

  /** The search box, for its caret (the scene's pad rules: A puts the caret in, B takes it out). */
  get searchField(): McSearchField | null {
    return this.renderRoot.querySelector<McSearchField>("mc-search-field");
  }

  override render() {
    const phone = this.size === "phone";
    return html`<div class="controls">
        <mc-search-field
          data-stop="search"
          data-key="search"
          .value=${this.search.value}
          .placeholder=${this.search.placeholder}
          .clearLabel=${this.search.clearLabel}
        ></mc-search-field>
        <mc-button
          class="sort"
          kind="secondary"
          data-stop="sort"
          data-key="sort"
          .label=${this.sortLabel}
          @mc-press=${() => this.emit({ type: "sort" })}
        ></mc-button>
      </div>
      ${
        this.chips.length > 0 || this.clearLabel
          ? html`<div class="chips">
              <mc-filter-bar
                .chips=${this.chips}
                prefix="chip:"
                stops
                .rows=${phone ? 1 : 2}
                .rowHeight=${40}
                @mc-activate=${(event: CustomEvent<{ id: string }>) => {
                  event.stopPropagation();
                  this.emit({ type: "chip", id: event.detail.id });
                }}
              ></mc-filter-bar>
              ${
                this.clearLabel
                  ? html`<mc-button
                      class="clear"
                      kind="secondary"
                      hug
                      data-stop="chip:clear"
                      data-key="chip:clear"
                      .label=${this.clearLabel}
                      @mc-press=${() => this.emit({ type: "clear" })}
                    ></mc-button>`
                  : nothing
              }
            </div>`
          : nothing
      }
      <div class="count">${this.countText}</div>`;
  }

  protected override updated(): void {
    this.emitRendered();
  }
}
