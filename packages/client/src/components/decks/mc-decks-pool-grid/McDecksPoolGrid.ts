import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { POOL_GRID_GAP, poolGridGeometry, type PoolGridGeometry } from "../../../view/deck-pool-grid.js";
import { gridWindow } from "./pool-window.js";
import type { DecksPoolCard } from "../decks.types.js";
import "../mc-decks-pool-cell/mc-decks-pool-cell.js";
import { McDecksPoolGridStyles } from "./mc-decks-pool-grid.styles.js";

/**
 * # Pool grid
 * The card pool's cards in a grid that scrolls natively and draws only the rows near its window (a hero's pool is hundreds of
 * scans): a spacer as tall as every row, and under it the rows in view with one above and one below. The columns come from the
 * grid's own width (`poolGridGeometry`, with the settings' card size), so the grid measures itself and draws again on a
 * resize. A cell is asked for (`cardAt`) only while its row is in the window. A tap on a cell raises `card`; the picture raises
 * the card hover and Inspect events.
 *
 * The scene makes one focus stop per card (`pool-card:<id>`) from `cellRect(index)` and `scrollToIndex(index)`, so the pad
 * reaches a card whose row is not drawn yet.
 *
 * @element mc-decks-pool-grid
 * @prop count - How many cards.
 * @prop cardAt - One card, by index.
 * @prop cardScale - The settings' card size factor (1).
 * @prop topKey - A changed value scrolls to the top (a new search, filter or deck).
 * @prop version - A changed value draws every cell again (a language, a shown card).
 * @fires mc-decks - `{ type: "card", cardId, via: "press" }`.
 */
export class McDecksPoolGrid extends LitElement {
  static override styles = [McDecksPoolGridStyles];

  static override properties: PropertyDeclarations = {
    count: { type: Number },
    cardAt: { attribute: false },
    cardScale: { type: Number },
    topKey: { type: Number },
    version: { type: String },
    width: { state: true },
    height: { state: true },
    top: { state: true },
  };

  declare count: number;
  declare cardAt: (index: number) => DecksPoolCard;
  declare cardScale: number;
  declare topKey: number;
  declare version: string;
  declare width: number;
  declare height: number;
  declare top: number;
  #resize: ResizeObserver | null = null;
  #seenTop = -1;

  constructor() {
    super();
    this.count = 0;
    this.cardAt = () => {
      throw new Error("mc-decks-pool-grid: no cardAt");
    };
    this.cardScale = 1;
    this.topKey = 0;
    this.version = "";
    this.width = 0;
    this.height = 0;
    this.top = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("scroll", this.#onScroll, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      this.#resize = new ResizeObserver(() => this.#measure());
      this.#resize.observe(this);
    }
    this.#measure();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("scroll", this.#onScroll);
    this.#resize?.disconnect();
    this.#resize = null;
  }

  #measure(): void {
    this.width = this.clientWidth;
    this.height = this.clientHeight;
  }

  #onScroll = (): void => {
    this.top = this.scrollTop;
  };

  /** The grid's geometry now, or null until the grid has a width. */
  get geometry(): PoolGridGeometry | null {
    return this.width > 0 ? poolGridGeometry(this.width, this.count, false, this.cardScale) : null;
  }

  /** Card `index`'s cell as the screen shows it now (the scroll applied), in viewport pixels. */
  cellRect(index: number): DOMRect {
    const geometry = this.geometry;
    const box = this.getBoundingClientRect();
    if (!geometry) return box;
    const row = Math.floor(index / geometry.columns);
    const column = index % geometry.columns;
    const rowHeight = geometry.cellHeight + POOL_GRID_GAP;
    return new DOMRect(
      box.left + column * (geometry.cellWidth + POOL_GRID_GAP),
      box.top + row * rowHeight - this.scrollTop,
      geometry.cellWidth,
      geometry.cellHeight,
    );
  }

  /** Scrolls card `index`'s row into view, as a pad focus does. */
  scrollToIndex(index: number): void {
    const geometry = this.geometry;
    if (!geometry) return;
    const rowHeight = geometry.cellHeight + POOL_GRID_GAP;
    const rowTop = Math.floor(index / geometry.columns) * rowHeight;
    const rowBottom = rowTop + geometry.cellHeight;
    if (rowTop < this.scrollTop) this.scrollTop = rowTop;
    else if (rowBottom > this.scrollTop + this.clientHeight) this.scrollTop = rowBottom - this.clientHeight;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("topKey") && this.topKey !== this.#seenTop) {
      this.#seenTop = this.topKey;
      this.scrollTop = 0;
      this.top = 0;
    }
  }

  override render() {
    const geometry = this.geometry;
    if (!geometry || this.count === 0) return nothing;
    const { columns, cellWidth, artHeight, captionHeight, cellHeight } = geometry;
    const view = gridWindow({
      count: this.count,
      columns,
      rowHeight: cellHeight + POOL_GRID_GAP,
      top: this.top,
      viewHeight: this.height,
    });
    const cells = [];
    for (let index = view.firstIndex; index < view.endIndex; index++) {
      const card = this.cardAt(index);
      cells.push(
        html`<mc-decks-pool-cell
          data-key=${`cell:${Math.floor(index / columns)}.${index % columns}`}
          data-card-id=${card.cardId}
          .card=${card}
          ?shown=${card.shown}
          @mc-pressed=${(event: CustomEvent<{ action: unknown }>) => {
            event.stopPropagation();
            this.dispatchEvent(
              new CustomEvent("mc-decks", {
                detail: { type: "card", cardId: card.cardId, via: "press" },
                bubbles: true,
                composed: true,
              }),
            );
          }}
        ></mc-decks-pool-cell>`,
      );
    }
    return html`<div class="space" style=${`height:${view.totalHeight}px`}>
      <div
        class="window"
        style=${`transform:translateY(${view.offset}px);grid-template-columns:repeat(${columns},${cellWidth}px);--cell-width:${cellWidth}px;--art-height:${artHeight}px;--caption-height:${captionHeight}px`}
      >
        ${cells}
      </div>
    </div>`;
  }
}
