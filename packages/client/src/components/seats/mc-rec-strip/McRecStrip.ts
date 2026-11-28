import { html, nothing, type PropertyDeclarations } from "lit";
import { SeatsElement } from "../SeatsElement.js";
import type { HeroShelfModel, PagingGlyphs } from "../seats.types.js";
import "../mc-hero-row/mc-hero-row.js";
import type { McHeroRow } from "../mc-hero-row/McHeroRow.js";
import { McRecStripStyles } from "./mc-rec-strip.styles.js";

/**
 * # Recommended strip
 * The Recommended shelf that leads the roster: heroes worth a look for the active seat, each tile saying why in its
 * caption. A band with a red rule down its edge holds the header ("Recommended for seat 2", "3 heroes · Hide") over the
 * tiles' row. The header is one stop, `rec-toggle`, and shows or hides the tiles (`open`); it raises the plain
 * `rec-toggle` action, not a shelf event, so it never reads as a pack's fold.
 *
 * @element mc-rec-strip
 * @prop shelf - The Recommended shelf (`HeroShelfModel`, id `recommended`; its tiles' keys are `hero-rec:<card id>`).
 * @prop previousLabel - The ‹ button's accessible name; `nextLabel` the › button's.
 * @prop hint - The pad's paging glyphs when this strip is the one in focus, or null.
 * @prop scrollRoot - The element that scrolls the page down (pictures load near its view).
 * @fires mc-seats - `{ type: "action", action: "rec-toggle" }`; a tile's `{ type: "hero", key, via }`.
 */
export class McRecStrip extends SeatsElement {
  static override styles = [McRecStripStyles];

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

  /** The row of tiles, for paging. */
  get row(): McHeroRow | null {
    return this.renderRoot.querySelector("mc-hero-row");
  }

  protected override act(action: string): void {
    if (action === "toggle") this.emit({ type: "action", action: "rec-toggle" });
  }

  override render() {
    const shelf = this.shelf;
    if (!shelf) return nothing;
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
        <mc-section-header .label=${shelf.title} .count=${shelf.count} .open=${shelf.open}></mc-section-header>
        <button
          type="button"
          class="tap"
          data-action="toggle"
          data-stop="rec-toggle"
          aria-label=${shelf.title}
          aria-expanded=${String(shelf.open !== false)}
        ></button>
      </div>
    </mc-hero-row>`;
  }
}
