import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { DecksElement } from "../shared/DecksElement.js";
import { DecksSharedStyles } from "../shared/decks-shared.styles.js";
import type { DecksListModel } from "../decks.types.js";
import "../mc-decks-import-box/mc-decks-import-box.js";
import "../mc-decks-list-filters/mc-decks-list-filters.js";
import { McDecksListStyles } from "./mc-decks-list.styles.js";

/** A pick or an inspect of a listed row, as `mc-deck-row` raises it. */
type RowEvent = CustomEvent<{ readonly deckId: string }>;

/**
 * # Decks list
 * The "Your decks" section: the heading with "+ New deck" on its rule, the status banner, the search and filters, the deck
 * rows (`mc-deck-row`, the listing look: one native scroller that takes every pixel the rest leaves) and the Import / Export
 * box pinned under it. A tap on a row selects its deck, a hold or Inspect inspects it. A `reveal` scrolls a deck into view
 * once, and a changed `topKey` scrolls the list to its top.
 *
 * Focus stops: `new-deck` and every stop of its children (`deck-search`, `filters-toggle`, `deck-chip:<id>`, `deck:<deck id>`,
 * the import box's).
 *
 * @element mc-decks-list
 * @prop model - The section (`DecksListModel`).
 * @fires mc-decks - `deck` (`press` / `inspect`), `action` `new-deck`, and its children's events as they bubble.
 */
export class McDecksList extends DecksElement {
  static override styles = [DecksSharedStyles, McDecksListStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DecksListModel | null;
  #topKey = -1;
  #revealKey = -1;

  constructor() {
    super();
    this.model = null;
  }

  /** The element that scrolls the rows (the pad's stick and paging scroll it). */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroll");
  }

  protected override updated(changed: PropertyValues): void {
    const model = this.model;
    const scroller = this.scroller;
    if (!model || !scroller || !changed.has("model")) return;
    if (model.topKey !== this.#topKey) {
      this.#topKey = model.topKey;
      scroller.scrollTop = 0;
    }
    if (model.reveal && model.reveal.key !== this.#revealKey) {
      this.#revealKey = model.reveal.key;
      const deckId = model.reveal.deckId;
      // The row is one child render behind this element: ask once it has drawn.
      requestAnimationFrame(() => {
        const row = [...this.renderRoot.querySelectorAll<HTMLElement>("mc-deck-row")].find(
          (candidate) => candidate.dataset.deckId === deckId,
        );
        row?.scrollIntoView({ block: "nearest" });
      });
    }
  }

  #row(event: RowEvent, via: "press" | "inspect"): void {
    event.stopPropagation();
    this.emit({ type: "deck", deckId: event.detail.deckId, via });
  }

  override render() {
    const list = this.model;
    if (!list) return nothing;
    return html`<div class="head heading">
        <h2>${list.heading}</h2>
        <span class="rule"></span>
        <div class="new">
          ${this.button({ action: "new-deck", label: list.newDeckLabel }, { kind: "secondary", hug: true, size: 11 })}
        </div>
      </div>
      ${
        list.status
          ? html`<p class="status" data-tone=${list.status.tone} role="status">
              <span aria-hidden="true">${list.status.tone === "error" ? "✕" : "✓"}</span>
              <span>${list.status.text}</span>
            </p>`
          : nothing
      }
      <mc-decks-list-filters
        class="filters"
        .model=${{
          search: list.search,
          filtersLabel: list.filtersLabel,
          filtersOpen: list.filtersOpen,
          chips: list.chips,
        }}
      ></mc-decks-list-filters>
      <div class="scroll" data-key="deck-list" style=${`--mc-deck-row-height:${list.rowHeight}px`}>
        ${repeat(
          list.rows,
          (row) => row.deckId,
          (row) =>
            html`<mc-deck-row
              class="row"
              data-deck-id=${row.deckId}
              data-key=${`row:${row.deckId}`}
              .model=${row}
              @mc-deck-pick=${(event: RowEvent) => this.#row(event, "press")}
              @mc-deck-inspect=${(event: RowEvent) => this.#row(event, "inspect")}
            ></mc-deck-row>`,
        )}
        ${list.empty ? html`<p class="empty">${list.empty}</p>` : nothing}
      </div>
      <mc-decks-import-box class="io" .model=${list.io}></mc-decks-import-box>`;
  }
}
