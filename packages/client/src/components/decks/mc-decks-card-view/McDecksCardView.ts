import { html, nothing, type PropertyDeclarations } from "lit";
import { DecksElement } from "../shared/DecksElement.js";
import { DecksSharedStyles } from "../shared/decks-shared.styles.js";
import type { DecksCardViewModel } from "../decks.types.js";
import "../mc-decks-thumb/mc-decks-thumb.js";
import { McDecksCardViewStyles } from "./mc-decks-card-view.styles.js";

/**
 * # Decks card view
 * A pool card shown in the stats pane in place of the deck's numbers (#529): a way back, the card's scan (a mouse over it opens
 * the popover) with its name and type, what your games say about it with this hero and with every hero, which of your decks
 * hold it, and Inspect at the foot.
 *
 * Focus stops: `card-back`, `card-inspect` (Enter on it and the route's Inspect both open the card).
 *
 * @element mc-decks-card-view
 * @prop model - The card (`DecksCardViewModel`).
 * @fires mc-decks - `{ type: "action", action: "card-back" | "card-inspect" }`.
 */
export class McDecksCardView extends DecksElement {
  static override styles = [DecksSharedStyles, McDecksCardViewStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DecksCardViewModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const card = this.model;
    if (!card) return nothing;
    return html`<div class="back">${this.button(card.back, { kind: "onInk", size: 11 })}</div>
      <div class="body">
        <div class="top">
          <mc-decks-thumb
            class="pic"
            data-key="card-pic"
            .picture=${card.picture}
            card-id=${card.cardId}
          ></mc-decks-thumb>
          <div class="who">
            <h3 class="name">${card.name}</h3>
            <span class="type">${card.typeLine}</span>
          </div>
        </div>
        ${card.blocks.map(
          (block) =>
            html`<section class="block">
              <h4>${block.title}</h4>
              ${
                block.lines
                  ? html`<dl>
                      ${block.lines.map(
                        (line) =>
                          html`<dt>${line.label}</dt>
                            <dd>${line.value}</dd>`,
                      )}
                    </dl>`
                  : html`<p class="empty">${block.empty}</p>`
              }
            </section>`,
        )}
        ${
          card.inDecks.length > 0
            ? html`<section class="block">
                <h4>${card.inDecksHeading}</h4>
                <ul>
                  ${card.inDecks.map((name) => html`<li>${name}</li>`)}
                </ul>
              </section>`
            : nothing
        }
      </div>
      <div class="inspect">${this.button(card.inspect, { kind: "onInk", size: 11 })}</div>`;
  }
}
