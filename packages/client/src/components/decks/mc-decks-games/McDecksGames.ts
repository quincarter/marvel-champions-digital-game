import { html, nothing, type PropertyDeclarations } from "lit";
import { DecksElement } from "../shared/DecksElement.js";
import { DecksSharedStyles } from "../shared/decks-shared.styles.js";
import type { DecksGamesBlock, DecksGamesModel } from "../decks.types.js";
import "../mc-decks-thumb/mc-decks-thumb.js";
import { McDecksGamesStyles } from "./mc-decks-games.styles.js";

/**
 * # Decks games
 * The stats pane's "From your games" view (#529), to read: the headline and insight about this hero's games, then lists of
 * cards (the Cut, Try and Keep lists, and, behind the Against stepper, what to try or cut against one villain), each card
 * with its scan (a mouse over it opens the card popover) and what the games say about it. The one button at the foot opens
 * the builder on the same tab. While the saves are being read it says so and nothing else.
 *
 * Focus stops: `games-against` (when there is more than one villain to step through), `games-open`.
 *
 * @element mc-decks-games
 * @prop model - The view (`DecksGamesModel`).
 * @fires mc-decks - `{ type: "action", action: "games-against" | "games-open" }`.
 */
export class McDecksGames extends DecksElement {
  static override styles = [DecksSharedStyles, McDecksGamesStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DecksGamesModel | null;

  constructor() {
    super();
    this.model = null;
  }

  #block(block: DecksGamesBlock) {
    switch (block.kind) {
      case "section":
        return html`<section class="section">
          <h3>${block.title}</h3>
          <ul>
            ${block.entries.map(
              (entry) =>
                html`<li class="entry">
                  <mc-decks-thumb class="thumb" .picture=${entry.picture} card-id=${entry.cardId}></mc-decks-thumb>
                  <span class="words">
                    <span class="name">${entry.name}</span>
                    <span class="detail">${entry.detail}</span>
                  </span>
                </li>`,
            )}
          </ul>
        </section>`;
      case "against":
        // With one villain there is nothing to step to: the button is drawn dimmed and is no stop.
        return html`<div class="against">
          ${
            block.enabled
              ? this.button({ action: "games-against", label: block.label }, { kind: "onInk", size: 11 })
              : html`<div class="ctl"><mc-button kind="onInk" disabled .label=${block.label}></mc-button></div>`
          }
        </div>`;
      case "note":
        return html`<p class="note">${block.text}</p>`;
    }
  }

  override render() {
    const games = this.model;
    if (!games) return nothing;
    if (games.reading !== null) return html`<p class="reading">${games.reading}</p>`;
    return html`<div class="body">
        ${games.headline ? html`<p class="headline">${games.headline}</p>` : nothing}
        ${games.insight ? html`<p class="insight">${games.insight}</p>` : nothing}
        ${games.blocks.map((block) => this.#block(block))}
      </div>
      <div class="open">${this.button(games.open, { kind: "onInk", size: 11 })}</div>`;
  }
}
