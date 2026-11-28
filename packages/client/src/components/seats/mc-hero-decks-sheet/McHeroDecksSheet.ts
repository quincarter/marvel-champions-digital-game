import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import "../mc-decks-sheet-header/mc-decks-sheet-header.js";
import { SeatsElement } from "../SeatsElement.js";
import type { DecksSheetModel } from "../seats.types.js";
import { McHeroDecksSheetStyles } from "./mc-hero-decks-sheet.styles.js";

/**
 * # Pick a deck
 * The sheet Take your seats opens when a hero tile stands for several decks: a header, one `mc-deck-row` per deck in a
 * natively scrolling list, and a Back button. It is a sheet: a scrim covers the whole screen under it, and a tap on the
 * scrim closes it and presses nothing beneath (the scrim takes the press; it is a tap, so the lift that ends a swipe never
 * closes it). Escape closes it too. It decides nothing: the scene seats the deck with the same code a single-deck tile runs.
 *
 * Needs `@mc/ui` defined (`mc-button`, `mc-deck-row`, `mc-picture-tile`). Focus stops: `deck:<deck id>` per row and `back`.
 *
 * @element mc-hero-decks-sheet
 * @prop model - The sheet (`DecksSheetModel`); null draws nothing.
 * @fires mc-seats - `{ type: "deck", deckId }` (a deck's Seat button) or `{ type: "decks-close" }` (Back, the scrim, Escape).
 */
export class McHeroDecksSheet extends SeatsElement {
  static override styles = [ThemeStyles, McHeroDecksSheetStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DecksSheetModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("keydown", this.#onKey);
    this.addEventListener("mc-deck-pick", this.#onPick as EventListener);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this.#onKey);
    this.removeEventListener("mc-deck-pick", this.#onPick as EventListener);
  }

  #onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    this.emit({ type: "decks-close" });
  };

  /** A row's pick becomes the screen's own event; the row's is not passed on. */
  #onPick = (event: CustomEvent<{ deckId: string }>): void => {
    event.stopPropagation();
    this.emit({ type: "deck", deckId: event.detail.deckId });
  };

  protected override act(action: string): void {
    if (action === "close") this.emit({ type: "decks-close" });
  }

  override render() {
    const sheet = this.model;
    if (!sheet) return nothing;
    return html`<div class="scrim" data-action="close"></div>
      <section class="box" role="dialog" aria-modal="true" aria-label=${sheet.title}>
        <mc-decks-sheet-header .heading=${sheet.title} .subtitle=${sheet.subtitle}></mc-decks-sheet-header>
        <div class="list scroller" tabindex="-1">
          ${repeat(
            sheet.decks,
            (deck) => deck.deckId,
            (deck) => html`<mc-deck-row .model=${deck}></mc-deck-row>`,
          )}
        </div>
        <mc-button
          class="back"
          kind="secondary"
          label=${sheet.backLabel}
          data-stop="back"
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.emit({ type: "decks-close" });
          }}
        ></mc-button>
      </section>`;
  }
}
