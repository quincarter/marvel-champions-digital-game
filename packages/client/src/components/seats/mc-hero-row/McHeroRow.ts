import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { SeatsElement } from "../SeatsElement.js";
import type { HeroTileModel, PagingGlyphs } from "../seats.types.js";
import "../mc-hero-tile/mc-hero-tile.js";
import type { McHeroTile } from "../mc-hero-tile/McHeroTile.js";
import { McHeroRowStyles } from "./mc-hero-row.styles.js";

/** How far outside the row a tile may be and still load its picture: a flick or a few arrow presses away. */
const NEAR_SIDEWAYS = "0px 320px 0px 160px";
const NEAR_DOWN = "160px 0px 320px 0px";
/** A page of a row, as a share of its width. */
const PAGE = 0.85;

/**
 * # Hero row
 * One row of hero tiles under a header strip: the `head` slot (the shelf's title, its See all) with the row's ‹ › buttons at
 * the strip's end, and the tiles scrolling sideways under a finger, a wheel or those buttons. The buttons are real buttons
 * beside the row, never over it. With `wrap` the tiles wrap as a grid (a pack opened to see all of it) and there are no
 * buttons. With `open` false only the strip shows (a folded shelf).
 *
 * The picture lease lives here: a tile loads its picture while it is near the row's view (sideways) and the row is near
 * `scrollRoot`'s view (down), and drops it when it is not. Without an `IntersectionObserver` every tile loads.
 *
 * @element mc-hero-row
 * @slot head - The strip's words and buttons.
 * @prop tiles - The tiles (`HeroTileModel[]`).
 * @prop open - Whether the tiles show (default true).
 * @prop wrap - Wrap the tiles as a grid, no buttons.
 * @prop scrollRoot - The element that scrolls the page down: where the row measures "near".
 * @prop previousLabel - The ‹ button's accessible name; `nextLabel` the › button's.
 * @prop shelfLabel - The shelf's title, added to both buttons' names.
 * @prop hint - The pad's paging glyphs to draw beside the buttons, or null.
 */
export class McHeroRow extends SeatsElement {
  static override styles = [McHeroRowStyles];

  static override properties: PropertyDeclarations = {
    tiles: { attribute: false },
    open: { type: Boolean },
    wrap: { type: Boolean, reflect: true },
    scrollRoot: { attribute: false },
    previousLabel: { type: String, attribute: "previous-label" },
    nextLabel: { type: String, attribute: "next-label" },
    shelfLabel: { type: String, attribute: "shelf-label" },
    hint: { attribute: false },
  };

  declare tiles: readonly HeroTileModel[];
  declare open: boolean;
  declare wrap: boolean;
  declare scrollRoot: Element | null;
  declare previousLabel: string;
  declare nextLabel: string;
  declare shelfLabel: string;
  declare hint: PagingGlyphs | null;

  readonly #windowed = typeof IntersectionObserver !== "undefined";
  /** The tiles the observer says are near the row's view now. */
  readonly #inView = new Set<string>();
  readonly #watched = new Set<Element>();
  #tileObserver: IntersectionObserver | null = null;
  #tileRoot: Element | null | undefined;
  #selfObserver: IntersectionObserver | null = null;
  #selfRoot: Element | null | undefined;
  /** Whether the row is near the page's view; a row far down the page holds no pictures. */
  #rowNear = true;

  constructor() {
    super();
    this.tiles = [];
    this.open = true;
    this.wrap = false;
    this.scrollRoot = null;
    this.previousLabel = "";
    this.nextLabel = "";
    this.shelfLabel = "";
    this.hint = null;
  }

  /** The element that scrolls the tiles sideways (or, wrapped, the grid). */
  get rowElement(): HTMLElement | null {
    return this.renderRoot.querySelector(".row");
  }

  protected override act(action: string): void {
    if (action === "prev") this.page(-1);
    else if (action === "next") this.page(1);
  }

  /** Whether the row can go that way now (it has more tiles to show on that side). */
  canPage(direction: 1 | -1): boolean {
    const row = this.rowElement;
    if (!row || this.wrap) return false;
    return direction < 0 ? row.scrollLeft > 1 : row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
  }

  /** Scrolls the row by a page; the key of the first tile at its start afterwards, or null when it cannot go that way. */
  page(direction: 1 | -1): string | null {
    const row = this.rowElement;
    if (!row || !this.canPage(direction)) return null;
    row.scrollLeft += direction * row.clientWidth * PAGE;
    const edge = row.getBoundingClientRect().left;
    for (const tile of row.querySelectorAll<McHeroTile>("mc-hero-tile")) {
      // The first card fully in view, at the row's left edge (one half under the edge is not the one to land on).
      if (tile.getBoundingClientRect().left >= edge - 1) return tile.model?.key ?? null;
    }
    return null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#tileObserver?.disconnect();
    this.#tileObserver = null;
    this.#tileRoot = undefined;
    this.#watched.clear();
    this.#selfObserver?.disconnect();
    this.#selfObserver = null;
    this.#selfRoot = undefined;
  }

  protected override updated(): void {
    super.updated();
    if (this.#windowed) this.#watch();
  }

  #watch(): void {
    // The row itself, against the page's scroller: a shelf far down holds no pictures yet.
    if (!this.wrap && this.#selfRoot !== this.scrollRoot) {
      this.#selfObserver?.disconnect();
      this.#selfRoot = this.scrollRoot;
      this.#selfObserver = new IntersectionObserver(
        (entries) => {
          const near = entries.some((entry) => entry.isIntersecting);
          if (near === this.#rowNear) return;
          this.#rowNear = near;
          this.requestUpdate();
        },
        { root: this.scrollRoot, rootMargin: NEAR_DOWN },
      );
      this.#selfObserver.observe(this);
      this.#rowNear = false;
    }
    if (this.wrap) this.#rowNear = true;
    const root = this.wrap ? this.scrollRoot : this.rowElement;
    if (this.#tileObserver && this.#tileRoot !== root) {
      this.#tileObserver.disconnect();
      this.#tileObserver = null;
      this.#watched.clear();
      this.#inView.clear();
    }
    this.#tileRoot = root;
    this.#tileObserver ??= new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.key;
          if (id === undefined || entry.isIntersecting === this.#inView.has(id)) continue;
          if (entry.isIntersecting) this.#inView.add(id);
          else this.#inView.delete(id);
          changed = true;
        }
        if (changed) this.requestUpdate();
      },
      { root, rootMargin: this.wrap ? NEAR_DOWN : NEAR_SIDEWAYS },
    );
    for (const tile of this.#watched) {
      if (tile.isConnected && this.renderRoot.contains(tile)) continue;
      this.#tileObserver.unobserve(tile);
      this.#watched.delete(tile);
      this.#inView.delete((tile as HTMLElement).dataset.key ?? "");
    }
    for (const tile of this.renderRoot.querySelectorAll("mc-hero-tile")) {
      if (this.#watched.has(tile)) continue;
      this.#watched.add(tile);
      this.#tileObserver.observe(tile);
    }
  }

  #nearOf(key: string): boolean {
    return !this.#windowed || (this.#rowNear && this.#inView.has(key));
  }

  #chevron(direction: 1 | -1) {
    const hint = this.hint;
    const specs = hint ? (direction < 0 ? hint.previous : hint.next) : null;
    return html`${
        hint && specs
          ? html`<mc-glyph
              class="hint"
              .specs=${specs}
              .height=${hint.height}
              .openness=${1}
              ground="paper"
              ?still=${hint.still}
            ></mc-glyph>`
          : nothing
      }<button
        type="button"
        class="chev"
        data-action=${direction < 0 ? "prev" : "next"}
        aria-label=${[direction < 0 ? this.previousLabel : this.nextLabel, this.shelfLabel]
          .filter((part) => part !== "")
          .join(": ")}
      >
        ${direction < 0 ? "‹" : "›"}
      </button>`;
  }

  override render() {
    const paged = this.open && !this.wrap;
    return html`<div class="bar">
        <slot name="head"></slot>
        ${paged ? html`<div class=${this.hint ? "chevrons hinted" : "chevrons"}>${this.#chevron(-1)}${this.#chevron(1)}</div>` : nothing}
      </div>
      ${
        this.open
          ? html`<div class="row">
              ${repeat(
                this.tiles,
                (tile) => tile.key,
                (tile) =>
                  html`<mc-hero-tile
                    data-key=${tile.key}
                    .model=${tile}
                    .near=${this.#nearOf(tile.key)}
                  ></mc-hero-tile>`,
              )}
            </div>`
          : nothing
      }`;
  }
}
