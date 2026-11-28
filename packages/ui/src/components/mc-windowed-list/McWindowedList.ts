import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { McWindowedListStyles } from "./mc-windowed-list.styles.js";
import type { ViewportBox, WindowDetail, WindowedItem } from "./mc-windowed-list.types.js";

/** The rows built above and below the viewport, so a scroll shows items already in place. */
export const WINDOW_OVERSCAN_ROWS = 2;

/**
 * The rows to build for a scroll offset: `[start, end)`, or an empty window with nothing to show. A scroll that leaves
 * both ends where they were needs no new rows.
 */
export function windowOf(
  rowHeight: number,
  rowCount: number,
  viewHeight: number,
  scrollTop: number,
  overscan = WINDOW_OVERSCAN_ROWS,
): WindowDetail {
  if (rowHeight <= 0 || rowCount <= 0) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rowCount, Math.ceil((scrollTop + viewHeight) / rowHeight) + overscan);
  return { start, end };
}

/**
 * # Windowed list
 * A native scroller as tall as every row, of which only the rows near the viewport are built, so a list of thousands of
 * items costs what a screen of them does. Rows are `columns` items wide (a grid of cards) or one (a list). `renderItem`
 * draws one item and is asked only for the items in the window. The list scrolls natively: a swipe over it presses
 * nothing, since its items take presses through `onTap`.
 *
 * Every item keeps its place in the layout whether or not it is built, so `rectOfIndex` can say where any item is (a
 * focus stop for a card that is scrolled away) and `scrollToIndex` brings it into view.
 *
 * @element mc-windowed-list
 * @attr count - How many items.
 * @attr row-height - One row's height in px (items in the same row share it).
 * @attr columns - Items per row (1).
 * @attr column-gap - The gap between items of a row, px.
 * @prop renderItem - `(index) => TemplateResult`.
 * @fires mc-window - `WindowDetail`: the rows built changed.
 */
export class McWindowedList extends LitElement {
  static override styles = [McWindowedListStyles];

  static override properties: PropertyDeclarations = {
    count: { type: Number },
    rowHeight: { type: Number, attribute: "row-height" },
    columns: { type: Number },
    columnGap: { type: Number, attribute: "column-gap" },
    renderItem: { attribute: false },
    scrolled: { state: true },
    viewHeight: { state: true },
  };

  declare count: number;
  declare rowHeight: number;
  declare columns: number;
  declare columnGap: number;
  declare renderItem: WindowedItem | null;
  declare scrolled: number;
  declare viewHeight: number;
  #resize: ResizeObserver | null = null;
  #told = "";

  constructor() {
    super();
    this.count = 0;
    this.rowHeight = 0;
    this.columns = 1;
    this.columnGap = 0;
    this.renderItem = null;
    this.scrolled = 0;
    this.viewHeight = 0;
  }

  /** How many rows the items fill. */
  get rows(): number {
    return Math.ceil(this.count / Math.max(1, this.columns));
  }

  /** The rows built now. */
  get window(): WindowDetail {
    return windowOf(this.rowHeight, this.rows, this.viewHeight, this.scrolled);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("scroll", this.#onScroll, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      this.#resize = new ResizeObserver(() => {
        this.viewHeight = this.clientHeight;
      });
      this.#resize.observe(this);
    }
    this.viewHeight = this.clientHeight;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("scroll", this.#onScroll);
    this.#resize?.disconnect();
    this.#resize = null;
  }

  readonly #onScroll = (): void => {
    this.scrolled = this.scrollTop;
  };

  /** Back to the top (a new search or filter). */
  resetScroll(): void {
    this.scrollTop = 0;
    this.scrolled = 0;
  }

  /** Where item `index` is on screen now, in viewport px, whether or not it is built. */
  rectOfIndex(index: number): ViewportBox {
    const box = this.getBoundingClientRect();
    const columns = Math.max(1, this.columns);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const width = Math.max(1, this.clientWidth);
    const cell = (width - (columns - 1) * this.columnGap) / columns;
    return {
      x: box.x + column * (cell + this.columnGap),
      y: box.y + row * this.rowHeight - this.scrollTop,
      width: cell,
      height: this.rowHeight,
    };
  }

  /** Scrolls so item `index` is wholly in view. */
  scrollToIndex(index: number): void {
    const row = Math.floor(index / Math.max(1, this.columns));
    const top = row * this.rowHeight;
    if (top < this.scrollTop) this.scrollTop = top;
    else if (top + this.rowHeight > this.scrollTop + this.clientHeight)
      this.scrollTop = top + this.rowHeight - this.clientHeight;
  }

  protected override updated(): void {
    const { start, end } = this.window;
    const key = `${start}-${end}-${this.rows}`;
    if (key === this.#told) return;
    this.#told = key;
    this.dispatchEvent(
      new CustomEvent<WindowDetail>("mc-window", { detail: { start, end }, bubbles: true, composed: true }),
    );
  }

  override render() {
    const render = this.renderItem;
    if (!render || this.rowHeight <= 0 || this.count <= 0) return nothing;
    const { start, end } = this.window;
    const columns = Math.max(1, this.columns);
    const rows = Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
    return html`<div class="space" style=${styleMap({ height: `${this.rows * this.rowHeight}px` })}>
      ${repeat(
        rows,
        (row) => row,
        (row) => {
          const first = row * columns;
          const inRow = Math.min(columns, this.count - first);
          return html`<div
            class="row"
            style=${styleMap({
              top: `${row * this.rowHeight}px`,
              height: `${this.rowHeight}px`,
              "--columns": String(columns),
              "--column-gap": `${this.columnGap}px`,
            })}
          >
            ${Array.from({ length: inRow }, (_, col) => render(first + col))}
          </div>`;
        },
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-windowed-list": McWindowedList;
  }
  interface HTMLElementEventMap {
    "mc-window": CustomEvent<WindowDetail>;
  }
}
