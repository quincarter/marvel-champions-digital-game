import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { ThemeStyles } from "@mc/ui";
import { ModStorePress } from "../shared/ModStorePress.js";
import type { ModStoreEventDetail } from "../shared/mod-store-events.types.js";
import { McPackTileStyles } from "./mc-pack-tile.styles.js";
import type { McPackTileProps, PackTileModel } from "./mc-pack-tile.types.js";

/**
 * # Pack tile
 * One pack of the store's grid, the pack look of `mc-media-row`: its picture (the cover, the catalog's thumbnail, the
 * featured card, or the pack's initial on ink while nothing has loaded), name, byline, summary, size and the state chip
 * (a mark and the words, never colour alone; the call to action, Install or Update, is the red one). A tap, or the
 * focus route's Enter, opens the pack's page.
 *
 * @element mc-pack-tile
 * @fires mc-mod-store - `{ type: "open-pack", id }`.
 */
export class McPackTile extends ModStorePress implements McPackTileProps {
  static override styles = [ThemeStyles, McPackTileStyles];

  static override properties: PropertyDeclarations = {
    ...ModStorePress.properties,
    tile: { attribute: false },
  };

  declare tile: PackTileModel | null;

  constructor() {
    super();
    this.tile = null;
  }

  protected override pressed(): ModStoreEventDetail | null {
    return this.tile ? { type: "open-pack", id: this.tile.id } : null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("tile") && this.tile) {
      // The keys the pad route and the specs know: `tile:<pack id>`.
      this.stop = `tile:${this.tile.id}`;
      this.setAttribute("data-key", this.stop);
    }
  }

  override render() {
    const tile = this.tile;
    if (!tile) return nothing;
    return html`<mc-media-row
      .heading=${tile.name}
      .meta=${tile.meta}
      .summary=${tile.summary}
      .foot=${tile.foot}
      .badge=${tile.badge}
      ?solid=${tile.solid}
      .src=${tile.thumb.src ?? ""}
      .retry=${tile.thumb.retry ?? ""}
      .letter=${tile.letter}
      .fit=${tile.thumb.fit}
      .focusY=${0.3}
    ></mc-media-row>`;
  }
}
