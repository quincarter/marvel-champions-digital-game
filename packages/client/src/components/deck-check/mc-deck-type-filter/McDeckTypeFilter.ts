import { html, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import { DeckCheckElement } from "../shared/DeckCheckElement.js";
import { McDeckTypeFilterStyles } from "./mc-deck-type-filter.styles.js";
import type { McDeckTypeFilterProps, TypeFilterChip } from "./mc-deck-type-filter.types.js";

/**
 * # Deck type filter
 * The rail's chips (All, Allies, Events, ...) that narrow the card list to one type. A display filter only: it never
 * changes the deck. The chosen chip is filled and the stop is `filter:<id>`.
 *
 * @element mc-deck-type-filter
 * @fires mc-deck-check - `{ type: "filter", filter }` on a tap on a chip.
 */
export class McDeckTypeFilter extends DeckCheckElement implements McDeckTypeFilterProps {
  static override styles = [ThemeStyles, McDeckTypeFilterStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    chips: { attribute: false },
    selected: { type: String },
  };

  declare heading: string;
  declare chips: readonly TypeFilterChip[];
  declare selected: string;

  constructor() {
    super();
    this.heading = "";
    this.chips = [];
    this.selected = "all";
  }

  override render() {
    return html`<div class="heading">${this.heading}</div>
      <div class="chips">
        ${repeat(
          this.chips,
          (chip) => chip.id,
          (chip) =>
            html`<mc-button
              kind="secondary"
              data-stop=${`filter:${chip.id}`}
              data-key=${`filter:${chip.id}`}
              .label=${chip.label}
              ?selected=${chip.id === this.selected}
              @mc-press=${() => this.emit({ type: "filter", filter: chip.id })}
            ></mc-button>`,
        )}
      </div>`;
  }
}
