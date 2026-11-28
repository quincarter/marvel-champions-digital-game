import { html, type PropertyDeclarations, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { keepScroll, restoreScroll } from "../shared/list-scroll.js";
import "../mc-pack-tile/mc-pack-tile.js";
import { McPackGridStyles } from "./mc-pack-grid.styles.js";
import type { McPackGridProps } from "./mc-pack-grid.types.js";
import type { PackTileModel } from "../mc-pack-tile/mc-pack-tile.types.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";

/**
 * # Pack grid
 * The store's packs as a native scrolling grid of `mc-pack-tile`s: as many columns as fit three hundred pixels each, a
 * row 136px tall (120 on a phone). Where it was scrolled to is kept by `listId` (a tab, under the filter it was left in)
 * and put back when that list comes round again; `scrollFrom` going up sends it to the top (a new filter).
 *
 * @element mc-pack-grid
 */
export class McPackGrid extends ModStoreElement implements McPackGridProps {
  static override styles = [ThemeStyles, McPackGridStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    tiles: { attribute: false },
    listId: { type: String, attribute: "list-id" },
    scrollFrom: { type: Number, attribute: "scroll-from" },
  };

  declare size: ModStoreSize;
  declare tiles: readonly PackTileModel[];
  declare listId: string;
  declare scrollFrom: number;

  constructor() {
    super();
    this.size = "wide";
    this.tiles = [];
    this.listId = "";
    this.scrollFrom = 0;
  }

  /** The native scroller: what the pad's stick and paging move. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroller");
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("scrollFrom") && changed.get("scrollFrom") !== undefined) keepScroll(this.listId, 0);
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has("listId") || changed.has("scrollFrom") || changed.has("tiles")) {
      restoreScroll(this.listId, this.scroller);
    }
    this.emitRendered();
  }

  override render() {
    return html`<div
      class="scroller grid"
      data-key="list:grid"
      @scroll=${(event: Event) => keepScroll(this.listId, (event.target as HTMLElement).scrollTop)}
    >
      ${repeat(
        this.tiles,
        (tile) => tile.id,
        (tile) => html`<mc-pack-tile .tile=${tile}></mc-pack-tile>`,
      )}
    </div>`;
  }
}
