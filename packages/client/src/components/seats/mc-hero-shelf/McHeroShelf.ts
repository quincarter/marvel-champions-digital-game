import { html, nothing, type PropertyDeclarations } from "lit";
import { SeatsElement } from "../SeatsElement.js";
import type { HeroShelfModel, PagingGlyphs } from "../seats.types.js";
import "../mc-hero-row/mc-hero-row.js";
import type { McHeroRow } from "../mc-hero-row/McHeroRow.js";
import { McHeroShelfStyles } from "./mc-hero-shelf.styles.js";

/**
 * # Hero shelf
 * One pack's shelf: a header (the pack's cover, its title with the rule and the count, a fold chevron, "See all") over a
 * sideways row of hero tiles (`mc-hero-row`). The header is one stop, `hero-shelf:<pack id>`: pressing it folds or
 * unfolds the shelf (`open` says which it is now) or, for a shelf that never folds (`open` undefined), opens the pack as
 * a grid. "See all" is a button of its own beside the row's ‹ ›.
 *
 * @element mc-hero-shelf
 * @prop shelf - The shelf (`HeroShelfModel`).
 * @prop previousLabel - The ‹ button's accessible name; `nextLabel` the › button's.
 * @prop hint - The pad's paging glyphs for this shelf, or null.
 * @prop scrollRoot - The element that scrolls the page down (pictures load near its view).
 * @fires mc-seats - `{ type: "shelf", id, change: "fold" | "all" }`; a tile's `{ type: "hero", key, via }`.
 */
export class McHeroShelf extends SeatsElement {
  static override styles = [McHeroShelfStyles];

  static override properties: PropertyDeclarations = {
    shelf: { attribute: false },
    previousLabel: { type: String, attribute: "previous-label" },
    nextLabel: { type: String, attribute: "next-label" },
    hint: { attribute: false },
    scrollRoot: { attribute: false },
  };

  declare shelf: HeroShelfModel | null;
  declare previousLabel: string;
  declare nextLabel: string;
  declare hint: PagingGlyphs | null;
  declare scrollRoot: Element | null;

  constructor() {
    super();
    this.shelf = null;
    this.previousLabel = "";
    this.nextLabel = "";
    this.hint = null;
    this.scrollRoot = null;
  }

  /** The row of tiles, for paging and scroll state. */
  get row(): McHeroRow | null {
    return this.renderRoot.querySelector("mc-hero-row");
  }

  protected override act(action: string): void {
    const shelf = this.shelf;
    if (!shelf) return;
    if (action === "all") this.emit({ type: "shelf", id: shelf.id, change: "all" });
    else if (action === "fold")
      this.emit({ type: "shelf", id: shelf.id, change: shelf.open === undefined ? "all" : "fold" });
  }

  override render() {
    const shelf = this.shelf;
    if (!shelf) return nothing;
    const folds = shelf.open !== undefined;
    return html`<mc-hero-row
      .tiles=${shelf.tiles}
      .open=${shelf.open !== false}
      .scrollRoot=${this.scrollRoot}
      .hint=${this.hint}
      previous-label=${this.previousLabel}
      next-label=${this.nextLabel}
      shelf-label=${shelf.title}
    >
      <div slot="head" class="title">
        ${shelf.cover ? html`<mc-picture-tile class="cover" .picture=${shelf.cover} .frame=${1.5}></mc-picture-tile>` : nothing}
        <mc-section-header .label=${shelf.title} .count=${shelf.count} .open=${shelf.open}></mc-section-header>
        <button
          type="button"
          class="tap"
          data-action="fold"
          data-stop=${`hero-shelf:${shelf.id}`}
          aria-label=${shelf.title}
          aria-expanded=${folds ? String(shelf.open) : nothing}
        ></button>
      </div>
      ${
        shelf.seeAll
          ? html`<button
              slot="head"
              type="button"
              class="all"
              data-action="all"
              aria-label=${`${shelf.seeAll}: ${shelf.title}`}
            >
              ${shelf.seeAll}
            </button>`
          : nothing
      }
    </mc-hero-row>`;
  }
}
