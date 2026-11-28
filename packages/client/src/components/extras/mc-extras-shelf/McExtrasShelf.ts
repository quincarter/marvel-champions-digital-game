import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import { ExtrasElement } from "../shared/ExtrasElement.js";
import { McExtrasShelfStyles } from "./mc-extras-shelf.styles.js";
import type { ExtrasShelfShape, ExtrasTile, McExtrasShelfProps } from "./mc-extras-shelf.types.js";

/**
 * # Extras shelf
 * One tab's tiles in a natively scrolling grid: a picture card each (the picture, a status chip, the title and a detail
 * line). A locked tile shows its picture as a gray, faded ghost with LOCKED and what opens it, so the shelf says what there
 * is to earn; an open one says what a tap does (READ, VIEW, PLAY). Every tile is a focus stop, `tile:<id>`. A promo card's tile
 * is also a card picture: the mouse over it opens the hover popover (`watchCard`, through the card).
 *
 * @element mc-extras-shelf
 * @fires mc-extras - `{ type: "tile", id }`.
 */
export class McExtrasShelf extends ExtrasElement implements McExtrasShelfProps {
  static override styles = [ThemeStyles, McExtrasShelfStyles];

  static override properties: PropertyDeclarations = {
    tiles: { attribute: false },
    shape: { type: String, reflect: true },
    empty: { type: String },
  };

  declare tiles: readonly ExtrasTile[];
  declare shape: ExtrasShelfShape;
  declare empty: string;

  constructor() {
    super();
    this.tiles = [];
    this.shape = "landscape";
    this.empty = "";
  }

  /** The scrolling element: the stick and paging move it, and a focused tile scrolls into view in it. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  override render() {
    if (this.tiles.length === 0) {
      return this.empty ? html`<mc-empty-state message=${this.empty}></mc-empty-state>` : nothing;
    }
    return html`<div class="scroller">
      <div class="grid">
        ${repeat(
          this.tiles,
          (tile) => tile.id,
          (tile) => html`<div class="tile">
            <mc-picture-card
              .model=${tile.card}
              .activateKey=${`tile:${tile.id}`}
              .stopKey=${`tile:${tile.id}`}
              .cardId=${tile.cardId ?? ""}
              data-promo-set=${tile.promoSetId ?? ""}
              @mc-activate=${(event: Event) => {
                event.stopPropagation();
                this.emit({ type: "tile", id: tile.id });
              }}
            ></mc-picture-card>
          </div>`,
        )}
      </div>
    </div>`;
  }
}
