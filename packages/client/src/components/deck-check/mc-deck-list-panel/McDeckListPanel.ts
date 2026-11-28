import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type LineListGroup } from "@mc/ui";
import { DeckCheckElement } from "../shared/DeckCheckElement.js";
import { McDeckListPanelStyles } from "./mc-deck-list-panel.styles.js";
import type { McDeckListPanelProps } from "./mc-deck-list-panel.types.js";

/**
 * # Deck list panel
 * The wide layout's ink rail: "YOUR DECK", the sort button, the deck's cards by group (`mc-line-list`, each line a card
 * the hover popover can show) and, in its `actions` slot, Edit deck and Start game.
 *
 * @element mc-deck-list-panel
 * @slot actions - The panel's foot.
 * @fires mc-deck-check - `{ type: "sort" }` on a tap on the sort button.
 */
export class McDeckListPanel extends DeckCheckElement implements McDeckListPanelProps {
  static override styles = [ThemeStyles, McDeckListPanelStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    sortLabel: { type: String, attribute: "sort-label" },
    groups: { attribute: false },
    more: { type: String },
  };

  declare heading: string;
  declare sortLabel: string;
  declare groups: readonly LineListGroup[];
  declare more: string;

  constructor() {
    super();
    this.heading = "";
    this.sortLabel = "";
    this.groups = [];
    this.more = "";
  }

  override render() {
    return html`<div class="head">
        <span class="heading">${this.heading}</span>
        <mc-button
          class="sort"
          kind="onInk"
          data-stop="deck-sort"
          data-key="deck-sort"
          .label=${this.sortLabel}
          @mc-press=${() => this.emit({ type: "sort" })}
        ></mc-button>
      </div>
      <mc-line-list class="list scroller" dark .groups=${this.groups}></mc-line-list>
      ${this.more ? html`<div class="more">${this.more}</div>` : nothing}
      <slot name="actions"></slot>`;
  }
}
