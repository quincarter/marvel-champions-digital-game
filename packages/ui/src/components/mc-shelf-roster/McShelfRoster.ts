import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import "../mc-button/mc-button.js";
import "../mc-empty-state/mc-empty-state.js";
import "../mc-picture-card/mc-picture-card.js";
import "../mc-section-header/mc-section-header.js";
import type { McPictureCard } from "../mc-picture-card/McPictureCard.js";
import type {
  ShelfRosterCard,
  ShelfRosterModel,
  ShelfRosterScroll,
  ShelfRosterShelf,
} from "./mc-shelf-roster.types.js";
import { McShelfRosterStyles } from "./mc-shelf-roster.styles.js";

/** The room reserved at each end of a row for its chevron, whether or not that chevron shows (cards never shift). */
export const SHELF_CHEVRON = 36;
/** The space between a shelf's header and its row. */
export const SHELF_HEADER_GAP = 8;

const EMPTY: ShelfRosterModel = {
  mode: "shelves",
  shelves: [],
  cardWidth: 200,
  cardHeight: 300,
  gap: 12,
  shelfGap: 18,
  headerHeight: 28,
  emptyText: null,
  previousLabel: "",
  nextLabel: "",
};

/**
 * # Shelf roster
 * The pack-shelf roster Scenario select and Take your seats share: one column of shelves that scrolls natively, each a
 * header (a fold mark, the title, a rule, a count and an optional "See all" link) over a row of cards that scrolls
 * sideways, with a chevron at each end where the row has more to show. A tap on a card raises `mc-activate` with its
 * `key`, a press-and-hold or a right-click `mc-inspect`; a tap on a header (or its link) raises `mc-activate` with the
 * shelf's (or the link's) key. Every press is a tap (`shared/tap.ts`): the lift that ends a swipe presses nothing. A
 * shelf below the view is not laid out until it nears it, and every picture loads lazily.
 *
 * In `grid` mode the cards of the first shelf wrap into rows with no header (a pack opened to every card).
 *
 * `elementOf(key)` gives a card, a header or a chevron (`chev:<shelf id>:prev|next`) for a focus ring; `hoverFaces()` the
 * pictures a card hover popover wants; `pageShelf(id, direction)` pages a row as its chevron would and reports the first
 * card then in view; `scrollState` reads and restores where the roster is scrolled (it survives the screen being left).
 *
 * @element mc-shelf-roster
 * @prop model - The shelves and sizes (`ShelfRosterModel`).
 * @fires mc-activate - `detail.key`: a card, a header or a link was tapped.
 * @fires mc-inspect - `detail.key`: a card was held or right-clicked.
 */
export class McShelfRoster extends LitElement {
  static override styles = [ThemeStyles, McShelfRosterStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: ShelfRosterModel;

  /** A scroll position to restore once the shelves are drawn. */
  #pending: ShelfRosterScroll | null = null;
  #observer: ResizeObserver | null = null;
  readonly #watched = new Set<HTMLElement>();

  constructor() {
    super();
    this.model = EMPTY;
  }

  /** The element that scrolls down the column. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  /** The element drawn for a key: a card, a shelf header (its bar), a header link or a chevron. */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  /** The row of a shelf, which scrolls sideways. */
  rowOf(shelfId: string): HTMLElement | null {
    return this.renderRoot.querySelector(`.row[data-shelf="${CSS.escape(shelfId)}"]`);
  }

  /** The pictures with their cards: where a hover popover is wanted. */
  hoverFaces(): { readonly cardId: string; readonly element: HTMLElement }[] {
    const faces: { cardId: string; element: HTMLElement }[] = [];
    for (const card of this.renderRoot.querySelectorAll<McPictureCard>("mc-picture-card")) {
      const element = card.artElement;
      const cardId = card.dataset.card;
      if (element && cardId) faces.push({ cardId, element });
    }
    return faces;
  }

  /** Where the roster is scrolled now. */
  get scrollState(): ShelfRosterScroll {
    const lefts: Record<string, number> = {};
    for (const row of this.renderRoot.querySelectorAll<HTMLElement>(".row[data-shelf]")) {
      if (row.scrollLeft > 0) lefts[row.dataset.shelf!] = row.scrollLeft;
    }
    return { top: this.scroller?.scrollTop ?? 0, lefts };
  }

  /** Restores a scroll position: now where the shelves are drawn, else as soon as they are. */
  set scrollState(state: ShelfRosterScroll) {
    this.#pending = state;
    this.#restore();
  }

  #restore(): void {
    const state = this.#pending;
    const scroller = this.scroller;
    if (!state || !scroller) return;
    this.#pending = null;
    scroller.scrollTop = state.top;
    for (const [id, left] of Object.entries(state.lefts)) {
      const row = this.rowOf(id);
      if (!row) continue;
      row.scrollLeft = left;
      this.#syncChevrons(row);
    }
  }

  /** How far a chevron pages a row: the cards that fit, whole, so none is cut at the edge it lands on. */
  #pageWidth(row: HTMLElement): number {
    const { cardWidth, gap } = this.model;
    const room = row.clientWidth - SHELF_CHEVRON * 2;
    const cards = Math.max(1, Math.floor((room + gap) / (cardWidth + gap)));
    return cards * (cardWidth + gap);
  }

  /**
   * Pages a shelf's row as its chevron does and returns the key of the first card then in view; null when the row has
   * nowhere to go that way.
   */
  pageShelf(shelfId: string, direction: 1 | -1): string | null {
    const row = this.rowOf(shelfId);
    if (!row) return null;
    const max = row.scrollWidth - row.clientWidth;
    const target = Math.max(0, Math.min(max, row.scrollLeft + direction * this.#pageWidth(row)));
    if (target === row.scrollLeft) return null;
    // Instant: the caller reads the cards in view straight after.
    row.scrollTo({ left: target, behavior: "instant" });
    this.#syncChevrons(row);
    return this.firstInView(shelfId);
  }

  /** The key of the first card of a shelf that is mostly in view in its row. */
  firstInView(shelfId: string): string | null {
    const row = this.rowOf(shelfId);
    if (!row) return null;
    const left = row.getBoundingClientRect().left + SHELF_CHEVRON;
    for (const cell of row.querySelectorAll<HTMLElement>(".cell")) {
      const box = cell.getBoundingClientRect();
      if (box.left + box.width / 2 >= left) return cell.dataset.key ?? null;
    }
    return null;
  }

  /** Shows a chevron only where its row has more that way. */
  #syncChevrons(row: HTMLElement): void {
    const shelf = row.closest<HTMLElement>(".shelf");
    if (!shelf) return;
    const max = row.scrollWidth - row.clientWidth;
    shelf.toggleAttribute("data-prev", row.scrollLeft > 1);
    shelf.toggleAttribute("data-next", row.scrollLeft < max - 1);
  }

  #emit(name: string, key: string): void {
    this.dispatchEvent(new CustomEvent(name, { detail: { key }, bubbles: true, composed: true }));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== "undefined") {
      this.#observer = new ResizeObserver((entries) => {
        for (const entry of entries) this.#syncChevrons(entry.target as HTMLElement);
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
    this.#watched.clear();
  }

  protected override updated(): void {
    const rows = new Set(this.renderRoot.querySelectorAll<HTMLElement>(".row[data-shelf]"));
    for (const row of this.#watched) {
      if (!rows.has(row)) {
        this.#observer?.unobserve(row);
        this.#watched.delete(row);
      }
    }
    for (const row of rows) {
      if (!this.#watched.has(row)) {
        this.#observer?.observe(row);
        this.#watched.add(row);
      }
      this.#syncChevrons(row);
    }
    this.#restore();
  }

  #card(card: ShelfRosterCard) {
    const { cardWidth, cardHeight } = this.model;
    return html`<div
      class="cell"
      data-key=${card.key}
      style=${`width:${cardWidth}px;height:${cardHeight}px`}
      ${tapped(
        () => this.#emit("mc-activate", card.key),
        () => this.#emit("mc-inspect", card.key),
      )}
    >
      <mc-picture-card data-card=${card.cardId} .model=${card.model} .picture=${card.picture ?? null}></mc-picture-card>
    </div>`;
  }

  #chevron(shelf: ShelfRosterShelf, direction: "prev" | "next") {
    return html`<div
      class=${`chev ${direction}`}
      data-key=${`chev:${shelf.id}:${direction}`}
      role="button"
      aria-label=${direction === "prev" ? this.model.previousLabel : this.model.nextLabel}
      ${tapped(() => {
        const row = this.rowOf(shelf.id);
        if (!row) return;
        row.scrollBy({ left: (direction === "prev" ? -1 : 1) * this.#pageWidth(row), behavior: "smooth" });
      })}
    >
      ${direction === "prev" ? "‹" : "›"}
    </div>`;
  }

  #shelf(shelf: ShelfRosterShelf) {
    const { headerHeight, cardHeight, shelfGap, gap } = this.model;
    const folded = shelf.collapsed === true;
    const height = folded ? headerHeight : headerHeight + SHELF_HEADER_GAP + cardHeight;
    return html`<section
      class="shelf"
      data-shelf=${shelf.id}
      style=${`--shelf-height:${height + shelfGap}px;padding-bottom:${shelfGap}px`}
    >
      <div class="head" style=${`height:${headerHeight}px`}>
        <div class="bar" data-key=${shelf.key} ${tapped(() => this.#emit("mc-activate", shelf.key))}>
          <mc-section-header .label=${shelf.title} .count=${shelf.count} .open=${shelf.open}></mc-section-header>
        </div>
        ${
          shelf.link
            ? html`<div
                class="link"
                data-key=${shelf.link.key}
                role="button"
                ${tapped(() => this.#emit("mc-activate", shelf.link!.key))}
              >
                ${shelf.link.label}
              </div>`
            : nothing
        }
      </div>
      ${
        folded
          ? nothing
          : html`<div class="rowbox" style=${`margin-top:${SHELF_HEADER_GAP}px;--mc-chevron:${SHELF_CHEVRON}px`}>
              <div class="row" data-shelf=${shelf.id} style=${`gap:${gap}px;height:${cardHeight}px`}>
                ${repeat(
                  shelf.cards,
                  (card) => card.key,
                  (card) => this.#card(card),
                )}
              </div>
              ${this.#chevron(shelf, "prev")}${this.#chevron(shelf, "next")}
            </div>`
      }
    </section>`;
  }

  override render() {
    const model = this.model;
    const action = model.emptyAction;
    const body =
      model.emptyText !== null
        ? html`<div class="empty">
            <mc-empty-state .message=${model.emptyText}></mc-empty-state>
            ${
              action
                ? html`<mc-button
                    kind="secondary"
                    data-key=${action.key}
                    .label=${action.label}
                    @mc-press=${() => this.#emit("mc-activate", action.key)}
                  ></mc-button>`
                : nothing
            }
          </div>`
        : model.mode === "grid"
          ? html`<div class="grid" style=${`gap:${model.shelfGap}px ${model.gap}px`}>
              ${repeat(
                model.shelves[0]?.cards ?? [],
                (card) => card.key,
                (card) => this.#card(card),
              )}
            </div>`
          : repeat(
              model.shelves,
              (shelf) => shelf.id,
              (shelf) => this.#shelf(shelf),
            );
    return html`<div class="scroller">${body}</div>`;
  }
}
