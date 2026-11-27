import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-button/mc-button.js";
import "../mc-empty-state/mc-empty-state.js";
import "../mc-list-row/mc-list-row.js";
import "../mc-picture-card/mc-picture-card.js";
import type { McListRow } from "../mc-list-row/McListRow.js";
import type { McPictureCard } from "../mc-picture-card/McPictureCard.js";
import { SCROLL_GUTTER } from "../../shared/scroll.js";
import type { DeckGridItem, DeckGridModel } from "./mc-deck-grid.types.js";

const styles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--mc-fill-parchment);
    box-shadow: inset 0 0 0 2px var(--mc-line-ink);
  }
  .scroller {
    position: absolute;
    left: 10px;
    top: 8px;
    bottom: 8px;
  }
  .content {
    padding: 2px 0 8px;
  }
  .grid {
    display: grid;
  }
  mc-button {
    --mc-button-size: 13px;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
`;

/**
 * # Deck grid
 * The deck picker's list: a grid of picture cards or a column of rows (`mc-picture-card`, `mc-list-row`) on a
 * parchment frame that scrolls inside. A tap on a tile or a row raises `mc-activate` with `open:<id>`; a row's Pick
 * button raises it with `pick:<id>` (a swipe's lift raises neither). Each item's element is `deck:<id>`, the button
 * `pick:<id>` (`elementOf`), for the screen's focus ring; `hoverFaces()` gives the pictures a card hover popover wants.
 *
 * @element mc-deck-grid
 * @fires mc-activate - `detail.key`.
 */
export class McDeckGrid extends LitElement {
  static override styles = [ThemeStyles, styles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DeckGridModel;

  constructor() {
    super();
    this.model = {
      mode: "grid",
      columns: 1,
      gap: 10,
      artHeight: 100,
      contentWidth: 0,
      items: [],
      emptyText: null,
      loading: false,
    };
  }

  /** The element that scrolls. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  /** The element drawn for a key: `deck:<id>` (a tile or row) or `pick:<id>` (a row's button). */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  /** The hero pictures, with their cards: where a hover popover is wanted. */
  hoverFaces(): { readonly cardId: string; readonly element: HTMLElement }[] {
    const faces: { cardId: string; element: HTMLElement }[] = [];
    const scroller = this.scroller;
    const top = scroller?.scrollTop ?? 0;
    const bottom = top + (scroller?.clientHeight ?? Number.MAX_SAFE_INTEGER);
    for (const item of this.renderRoot.querySelectorAll<McPictureCard | McListRow>("mc-picture-card, mc-list-row")) {
      // Only the ones in view: a long list is not measured, tile by tile, on every pointer move.
      if (item.offsetTop + item.offsetHeight < top || item.offsetTop > bottom) continue;
      const element = item.artElement;
      const cardId = item.dataset.card;
      if (element && cardId) faces.push({ cardId, element });
    }
    return faces;
  }

  #pressed(event: Event, key: string): void {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key }, bubbles: true, composed: true }));
  }

  #tile(item: DeckGridItem) {
    const { artHeight } = this.model;
    return html`<mc-picture-card
      paper
      data-key=${`deck:${item.id}`}
      data-card=${item.cardId}
      style=${`height:${artHeight + 66}px`}
      .picture=${item.picture}
      .lines=${item.lines}
      .stripe=${item.stripe}
      .artHeight=${artHeight}
      .heavy=${item.heavy}
      activate-key=${`open:${item.id}`}
    ></mc-picture-card>`;
  }

  #row(item: DeckGridItem) {
    const pick = item.pick;
    return html`<mc-list-row
      data-key=${`deck:${item.id}`}
      data-card=${item.cardId}
      .picture=${item.picture}
      .lines=${item.lines}
      .heavy=${item.heavy}
      activate-key=${`open:${item.id}`}
    >
      ${
        pick
          ? html`<mc-button
              slot="trailing"
              data-key=${`pick:${item.id}`}
              kind=${pick.look}
              .label=${pick.label}
              ?disabled=${pick.disabled !== undefined}
              ?pressable=${pick.disabled !== undefined}
              .reason=${typeof pick.disabled === "string" ? pick.disabled : ""}
              @mc-press=${(event: Event) => this.#pressed(event, `pick:${item.id}`)}
            ></mc-button>`
          : nothing
      }
    </mc-list-row>`;
  }

  override render() {
    const { mode, columns, gap, contentWidth, items, emptyText, loading } = this.model;
    const body =
      emptyText !== null
        ? html`<mc-empty-state .message=${emptyText} ?dim=${loading}></mc-empty-state>`
        : mode === "grid"
          ? html`<div class="grid" style=${`grid-template-columns:repeat(${columns},1fr);gap:${gap}px`}>
              ${repeat(
                items,
                (item) => item.id,
                (item) => this.#tile(item),
              )}
            </div>`
          : html`<div class="rows">
              ${repeat(
                items,
                (item) => item.id,
                (item) => this.#row(item),
              )}
            </div>`;
    return html`<div class="scroller" style=${`width:${contentWidth + SCROLL_GUTTER}px`}>
      <div class="content" style=${`width:${contentWidth}px`}>${body}</div>
    </div>`;
  }
}
