import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import "../mc-button/mc-button.js";
import "../mc-empty-state/mc-empty-state.js";
import "../mc-glyph/mc-glyph.js";
import "../mc-picture-card/mc-picture-card.js";
import "../mc-picture-tile/mc-picture-tile.js";
import "../mc-section-header/mc-section-header.js";
import type { McPictureCard } from "../mc-picture-card/McPictureCard.js";
import { SCROLL_GUTTER } from "../mc-sheet/McSheet.js";
import type { PictureSource } from "../../shared/picture.types.js";
import { McShelfRosterStyles } from "./mc-shelf-roster.styles.js";
import type { ShelfRosterHint, ShelfRosterItem, ShelfRosterModel, ShelfRosterShelf } from "./mc-shelf-roster.types.js";

/**
 * How far outside the box a tile may be and still load its picture, px: a tile loads when a finger's flick or a few
 * arrow presses away, so the first screen fetches the pictures it shows and not every shelf's.
 */
const NEAR = "160px 320px";
/** The key a tile reports: its own, or `entry:<id>`. */
const keyOf = (item: ShelfRosterItem): string => item.key ?? `entry:${item.id}`;
/** A tile key as the id `pageShelf` reports: `entry:<id>` gives the id, any other key itself. */
const idOfKey = (key: string): string => key.replace(/^entry:/, "");

/** A page of a row, as a share of its width. */
const PAGE = 0.85;

/**
 * # Shelf roster
 * The pack shelves of a pick-one screen (Scenario select): one shelf per pack, each a header (a pack cover, the title with
 * its rule, the count, a fold chevron, "See all") over a row of `mc-picture-card`s that scrolls sideways under a finger, a
 * wheel or the row's ‹ › buttons, the whole stack scrolling down inside. In `grid` mode the first shelf's tiles wrap as a
 * grid with no header (a pack opened to see all of it).
 *
 * A tap on a tile raises `mc-activate` with `entry:<id>`, a hold or a right-click `mc-inspect` with the same key; the header
 * raises `fold:<shelf>`, its "See all" `all:<shelf>`, the empty state's button `clear` (a swipe's lift raises none).
 * A tile's picture is fetched once the tile is near the box (`IntersectionObserver`, `NEAR`), then kept; before that the tile
 * shows its plain ground. `elementOf` finds each by key, `hoverFaces()` gives the pictures a hover popover wants, `pageShelf` scrolls a row by a page.
 *
 * @element mc-shelf-roster
 * @prop model - What to draw (`ShelfRosterModel`).
 * @fires mc-activate - `detail.key`.
 * @fires mc-inspect - `detail.key`.
 */
export class McShelfRoster extends LitElement {
  static override styles = [ThemeStyles, McShelfRosterStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: ShelfRosterModel;
  /** The tiles that have been near the box: their pictures load (and stay loaded). */
  readonly #near = new Set<string>();
  /** The tiles the observer is watching: dropped when a tile leaves the page, so filtering and folding never pile them up. */
  readonly #watched = new Set<Element>();
  #observer: IntersectionObserver | null = null;
  /** Watches the headers: one cut by the box's edge hides its buttons, so a sliver of them never peeks in. */
  #headObserver: IntersectionObserver | null = null;
  readonly #heads = new Set<Element>();
  /** Without an `IntersectionObserver` every tile loads at once. */
  readonly #windowed = typeof IntersectionObserver !== "undefined";

  constructor() {
    super();
    this.model = {
      mode: "shelves",
      shelves: [],
      cardWidth: 280,
      cardHeight: 320,
      gap: 12,
      contentWidth: 0,
      previousLabel: "",
      nextLabel: "",
      emptyText: null,
      clearLabel: "",
    };
  }

  protected override willUpdate(): void {
    this.toggleAttribute("fluid", this.model.cardWidth === 0);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
    // Reconnected, the tiles are watched afresh by a new observer.
    this.#watched.clear();
    this.#headObserver?.disconnect();
    this.#headObserver = null;
    this.#heads.clear();
  }

  protected override updated(): void {
    if (!this.#windowed) return;
    const root = this.scroller;
    if (!root) return;
    this.#observer ??= new IntersectionObserver(
      (entries) => {
        let fresh = false;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.key;
          if (!entry.isIntersecting || id === undefined || this.#near.has(id)) continue;
          this.#near.add(id);
          this.#observer?.unobserve(entry.target);
          this.#watched.delete(entry.target);
          fresh = true;
        }
        if (fresh) this.requestUpdate();
      },
      { root, rootMargin: NEAR },
    );
    this.#headObserver ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const clipped = entry.intersectionRatio < 0.99;
          (entry.target as HTMLElement).toggleAttribute("data-clipped", clipped);
        }
      },
      { root, threshold: [0.99, 1] },
    );
    for (const head of this.#heads) {
      if (head.isConnected && this.renderRoot.contains(head)) continue;
      this.#headObserver.unobserve(head);
      this.#heads.delete(head);
    }
    for (const head of this.renderRoot.querySelectorAll(".head")) {
      if (this.#heads.has(head)) continue;
      this.#heads.add(head);
      this.#headObserver.observe(head);
    }
    // A tile that has left the page (filtered away, its shelf folded) is no longer watched.
    for (const card of this.#watched) {
      if (card.isConnected && this.renderRoot.contains(card)) continue;
      this.#observer.unobserve(card);
      this.#watched.delete(card);
    }
    for (const card of this.renderRoot.querySelectorAll("mc-picture-card")) {
      if (this.#watched.has(card) || this.#near.has((card as HTMLElement).dataset.key ?? "")) continue;
      this.#watched.add(card);
      this.#observer.observe(card);
    }
  }

  /** How many tiles are being watched now (tests: it must follow the tiles on the page, not grow). */
  get watchedCount(): number {
    return this.#watched.size;
  }

  /** The tile's picture, or its plain ground until the tile has been near the box. */
  #pictureOf(item: ShelfRosterItem): PictureSource {
    return !this.#windowed || this.#near.has(keyOf(item)) ? item.picture : { ...item.picture, src: null };
  }

  /** The element that scrolls down. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  /** The element that scrolls a shelf's row sideways. */
  rowOf(shelfId: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-row="${CSS.escape(shelfId)}"]`);
  }

  /** The element drawn for a key: `entry:<id>`, `fold:<shelf>`, `all:<shelf>` or `clear`. */
  elementOf(key: string): HTMLElement | null {
    return this.renderRoot.querySelector(`[data-key="${CSS.escape(key)}"]`);
  }

  /** The tile pictures, with their cards: where a hover popover is wanted. */
  hoverFaces(): { readonly cardId: string; readonly element: HTMLElement }[] {
    const faces: { cardId: string; element: HTMLElement }[] = [];
    for (const item of this.renderRoot.querySelectorAll<McPictureCard>("mc-picture-card")) {
      const element = item.artElement;
      const cardId = item.dataset.card;
      if (element && cardId) faces.push({ cardId, element });
    }
    return faces;
  }

  /** Whether the row can go that way now (it has more tiles to show on that side). */
  canPageShelf(shelfId: string, direction: 1 | -1): boolean {
    const row = this.rowOf(shelfId);
    if (!row) return false;
    return direction < 0 ? row.scrollLeft > 1 : row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
  }

  /** Scrolls a shelf's row by a page; the id of the first tile at its start afterwards, or null when it cannot go that way. */
  pageShelf(shelfId: string, direction: 1 | -1): string | null {
    const row = this.rowOf(shelfId);
    if (!row || !this.canPageShelf(shelfId, direction)) return null;
    row.scrollBy({ left: direction * row.clientWidth * PAGE, behavior: "instant" });
    const edge = row.getBoundingClientRect().left;
    for (const tile of row.querySelectorAll<HTMLElement>("[data-key]")) {
      if (tile.getBoundingClientRect().right > edge + 1) return idOfKey(tile.dataset.key ?? "") || null;
    }
    return null;
  }

  /** Every row's sideways position and the vertical one, to hand back to `restoreScroll` on a later visit. */
  readScroll(): { readonly top: number; readonly rows: Readonly<Record<string, number>> } {
    const rows: Record<string, number> = {};
    for (const row of this.renderRoot.querySelectorAll<HTMLElement>("[data-row]")) {
      if (row.scrollLeft > 0) rows[row.dataset.row!] = row.scrollLeft;
    }
    return { top: this.scroller?.scrollTop ?? 0, rows };
  }

  restoreScroll(state: { readonly top: number; readonly rows: Readonly<Record<string, number>> }): void {
    const scroller = this.scroller;
    if (scroller) scroller.scrollTop = state.top;
    for (const [id, left] of Object.entries(state.rows)) {
      const row = this.rowOf(id);
      if (row) row.scrollLeft = left;
    }
  }

  /**
   * A button's native `click` from the keyboard (Enter or Space: `detail` 0) acts; one from a pointer does not, as the
   * tap (`shared/tap.ts`) already took it, and the lift that ends a swipe is no press.
   */
  #keyboardClick(act: () => void): (event: MouseEvent) => void {
    return (event) => {
      if (event.detail === 0) act();
    };
  }

  #emit(name: string, key: string): void {
    this.dispatchEvent(new CustomEvent(name, { detail: { key }, bubbles: true, composed: true }));
  }

  #tile(item: ShelfRosterItem) {
    const { cardWidth, cardHeight, stops } = this.model;
    const key = keyOf(item);
    return html`<mc-picture-card
      data-key=${key}
      ?data-dim=${item.dim === true}
      data-card=${item.cardId}
      style=${cardWidth === 0 ? nothing : `width:${cardWidth}px;height:${cardHeight}px`}
      .picture=${this.#pictureOf(item)}
      .model=${item.card}
      ?selected=${item.selected}
      activate-key=${key}
      card-id=${item.cardId}
      .cardFace=${item.face}
      stop-key=${stops ? `${stops.entry}${item.id}` : ""}
      inspect-key=${item.inspect ? key : ""}
    ></mc-picture-card>`;
  }

  /** A trigger glyph beside a chevron: LT before the previous one, RT before the next. */
  #hint(hint: ShelfRosterHint, direction: 1 | -1) {
    const specs = direction < 0 ? hint.previous : hint.next;
    if (!specs) return nothing;
    return html`<span class="hint" data-key=${`hint:${direction < 0 ? "prev" : "next"}`}
      ><mc-glyph .specs=${specs} .height=${hint.height} .openness=${1} ground="paper" ?still=${hint.still}></mc-glyph
    ></span>`;
  }

  #head(shelf: ShelfRosterShelf) {
    const { previousLabel, nextLabel, hint } = this.model;
    const hinted = hint?.shelfId === shelf.id;
    const folds = shelf.open !== undefined;
    const key = folds ? `fold:${shelf.id}` : `all:${shelf.id}`;
    return html`<div class="head">
      <div class="title">
        ${shelf.cover ? html`<mc-picture-tile .picture=${shelf.cover} .frame=${1.5}></mc-picture-tile>` : nothing}
        <mc-section-header .label=${shelf.title} .count=${shelf.count} .open=${shelf.open}></mc-section-header>
        <button
          type="button"
          class="tap"
          data-key=${key}
          data-stop=${folds && this.model.stops ? `${this.model.stops.fold}${shelf.id}` : nothing}
          aria-label=${shelf.title}
          aria-expanded=${folds ? String(shelf.open) : nothing}
          ${tapped(() => this.#emit("mc-activate", key))}
          @click=${this.#keyboardClick(() => this.#emit("mc-activate", key))}
        ></button>
      </div>
      ${
        shelf.seeAll
          ? html`<button
              type="button"
              class="all"
              aria-label=${`${shelf.seeAll}: ${shelf.title}`}
              data-key=${`all:${shelf.id}`}
              ${tapped(() => this.#emit("mc-activate", `all:${shelf.id}`))}
              @click=${this.#keyboardClick(() => this.#emit("mc-activate", `all:${shelf.id}`))}
            >
              ${shelf.seeAll}
            </button>`
          : nothing
      }
      ${
        shelf.open === false
          ? nothing
          : html`<div class=${hinted ? "chevrons hinted" : "chevrons"}>
              ${[-1, 1].map(
                (direction) =>
                  html`${hinted ? this.#hint(hint, direction as 1 | -1) : nothing}<button
                      type="button"
                      data-key=${`chev:${shelf.id}:${direction < 0 ? "prev" : "next"}`}
                      aria-label=${`${direction < 0 ? previousLabel : nextLabel}: ${shelf.title}`}
                      ${tapped(() => this.pageShelf(shelf.id, direction as 1 | -1))}
                      @click=${this.#keyboardClick(() => this.pageShelf(shelf.id, direction as 1 | -1))}
                    >
                      ${direction < 0 ? "‹" : "›"}
                    </button>`,
              )}
            </div>`
      }
    </div>`;
  }

  #shelf(shelf: ShelfRosterShelf) {
    const { gap } = this.model;
    return html`<section class="shelf">
      ${this.#head(shelf)}
      ${
        shelf.open === false
          ? nothing
          : html`<div class="row" data-row=${shelf.id} style=${`gap:${gap}px`}>
              ${repeat(
                shelf.items,
                (item) => item.id,
                (item) => this.#tile(item),
              )}
            </div>`
      }
    </section>`;
  }

  override render() {
    const { mode, shelves, contentWidth, emptyText, clearLabel, gap } = this.model;
    let body;
    if (emptyText !== null) {
      body = html`<mc-empty-state .message=${emptyText}></mc-empty-state> ${
          clearLabel
            ? html`<mc-button
                kind="quiet"
                data-key="clear"
                data-stop=${this.model.stops?.clear ?? nothing}
                .label=${clearLabel}
                @mc-press=${(event: Event) => {
                  event.stopPropagation();
                  this.#emit("mc-activate", "clear");
                }}
              ></mc-button>`
            : nothing
        }`;
    } else if (mode === "grid") {
      body = html`<div class="grid" style=${`gap:${gap}px`}>
        ${repeat(
          shelves[0]?.items ?? [],
          (item) => item.id,
          (item) => this.#tile(item),
        )}
      </div>`;
    } else {
      body = repeat(
        shelves,
        (shelf) => shelf.id,
        (shelf) => this.#shelf(shelf),
      );
    }
    const fluid = contentWidth === 0;
    return html`<div class="scroller" style=${fluid ? nothing : `width:${contentWidth + SCROLL_GUTTER}px`}>
      <div class="content" style=${fluid ? nothing : `width:${contentWidth}px`}>${body}</div>
    </div>`;
  }
}
