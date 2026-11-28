import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import "../mc-deck-line/mc-deck-line.js";
import { McDeckListStyles } from "./mc-deck-list.styles.js";
import type { DeckListModel } from "./mc-deck-list.types.js";

/**
 * # Deck list
 * "Your deck": the Sort button (issue #594), the Review button (issue #595) and every line by group (none folded into "+ N
 * more"), each with its own "-" while the deck can be edited. On the wide rail the list scrolls inside its own room; in the
 * narrow Deck tab (`flow`) it flows and the tab scrolls. Review rides in the pinned bar on a phone's Deck tab, so the model
 * leaves it out there.
 *
 * Focus stops: `deck-sort`, `deck-review`.
 *
 * @element mc-deck-list
 * @prop model - The list (`DeckListModel`).
 * @attr flow - The list does not scroll itself.
 * @attr on-dark - On the ink panel: its buttons are the on-ink kind.
 * @fires mc-deck-builder - `deck-sort`, `review`, and its lines' `remove` and `open`.
 */
export class McDeckList extends BuilderElement {
  static override styles = [ThemeStyles, McDeckListStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    flow: { type: Boolean, reflect: true },
    onDark: { type: Boolean, attribute: "on-dark", reflect: true },
  };

  declare model: DeckListModel | null;
  declare flow: boolean;
  declare onDark: boolean;

  constructor() {
    super();
    this.model = null;
    this.flow = false;
    this.onDark = false;
  }

  /** The lines' scroller, for the pad's stick and paging. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".groups");
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="label">${model.label}</div>
      <div class="controls">
        <mc-button
          kind=${this.onDark ? "onInk" : "secondary"}
          data-stop="deck-sort"
          .label=${model.sortLabel}
          @mc-press=${this.send({ type: "deck-sort" })}
        ></mc-button>
        ${
          model.reviewLabel !== null
            ? html`<mc-button
                kind=${this.onDark ? "onInk" : "secondary"}
                data-stop="deck-review"
                .label=${model.reviewLabel}
                ?disabled=${model.reviewDisabled}
                @mc-press=${this.send({ type: "review" })}
              ></mc-button>`
            : nothing
        }
      </div>
      <div class="groups">
        ${model.groups.map(
          (group) =>
            html`<div class="group">
              <div class="head">${group.label}</div>
              ${group.lines.map((line) => html`<mc-deck-line .model=${line}></mc-deck-line>`)}
            </div>`,
        )}
      </div>`;
  }
}
