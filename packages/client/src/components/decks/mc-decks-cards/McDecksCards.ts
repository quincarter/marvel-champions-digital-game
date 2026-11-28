import { html, nothing, type PropertyDeclarations } from "lit";
import type { McSearchDetail } from "@mc/ui";
import { DecksElement } from "../shared/DecksElement.js";
import { DecksSharedStyles } from "../shared/decks-shared.styles.js";
import type { DecksCardsModel } from "../decks.types.js";
import "../mc-decks-pool-grid/mc-decks-pool-grid.js";
import type { McDecksPoolGrid } from "../mc-decks-pool-grid/McDecksPoolGrid.js";
import { McDecksCardsStyles } from "./mc-decks-cards.styles.js";

/**
 * # Decks cards
 * The "Card pool" section: the heading with its rule and the filter chips (the aspects the deck uses, Basic, Hero, a Cost sort;
 * a phone folds them behind a Filters button), the text search, then the selected deck's browsable cards as a windowed grid
 * (`mc-decks-pool-grid`), or one line saying why there are none. A tap on a card opens it in the stats pane.
 *
 * Focus stops: `pool-chip:filters` (where folded), `pool-chip:<chip id>`, `pool-search`; the cards' stops are the scene's.
 *
 * @element mc-decks-cards
 * @prop model - The section (`DecksCardsModel`).
 * @fires mc-decks - `chip` (list `pool`), `search` (list `pool`), `action` `pool-filters-toggle`, and `card` from the grid.
 * @fires mc-search-focus - Bubbles from the search field: whether the caret is in it.
 */
export class McDecksCards extends DecksElement {
  static override styles = [DecksSharedStyles, McDecksCardsStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DecksCardsModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The grid, for the focus stops' rects and scrolling. */
  get grid(): McDecksPoolGrid | null {
    return this.renderRoot.querySelector("mc-decks-pool-grid");
  }

  /** The search field, for the scene's text-field escape and its caret. */
  get field(): HTMLElement | null {
    return this.renderRoot.querySelector("mc-search-field");
  }

  override render() {
    const cards = this.model;
    if (!cards) return nothing;
    const chipsShown = cards.foldable === null || cards.foldable.open;
    return html`<div class="head heading">
        <h2>${cards.title}</h2>
        <span class="rule"></span>
        ${
          cards.foldable
            ? html`<div class="fold">
                ${this.button(
                  {
                    action: "pool-filters-toggle",
                    label: `${cards.foldable.label} ${cards.foldable.open ? "▴" : "▾"}`,
                  },
                  { kind: "secondary", stop: "pool-chip:filters", selected: cards.foldable.open, size: 11 },
                )}
              </div>`
            : nothing
        }
        ${
          cards.foldable === null && cards.chips.length > 0
            ? html`<div class="chips beside">${this.chips("pool", cards.chips, "pool-chip")}</div>`
            : nothing
        }
      </div>
      ${
        cards.foldable && chipsShown && cards.chips.length > 0
          ? html`<div class="chips below">${this.chips("pool", cards.chips, "pool-chip")}</div>`
          : nothing
      }
      ${
        cards.search
          ? html`<mc-search-field
              class="search"
              data-key="pool-search"
              data-stop="pool-search"
              .value=${cards.search.text}
              .placeholder=${cards.search.placeholder}
              .clearLabel=${cards.search.clearLabel}
              .focusPlaceholder=${cards.search.focusPlaceholder ?? ""}
              .maxLength=${120}
              .debounce=${200}
              escape-clears
              @mc-search=${(event: CustomEvent<McSearchDetail>) => {
                event.stopPropagation();
                this.emit({ type: "search", list: "pool", text: event.detail.value });
              }}
            ></mc-search-field>`
          : nothing
      }
      ${
        cards.empty
          ? html`<mc-empty-state class="empty" .message=${cards.empty}></mc-empty-state>`
          : html`<mc-decks-pool-grid
              class="grid"
              .count=${cards.cardIds.length}
              .cardAt=${cards.cardAt}
              .cardScale=${cards.cardScale}
              .topKey=${cards.topKey}
              .version=${cards.version}
            ></mc-decks-pool-grid>`
      }`;
  }
}
