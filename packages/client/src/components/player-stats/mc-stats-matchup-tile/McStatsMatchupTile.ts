import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { watchCard } from "@mc/ui";
import { StatsTileBase } from "../shared/StatsTileBase.js";
import { McStatsMatchupTileStyles } from "./mc-stats-matchup-tile.styles.js";
import type { McStatsMatchupTileProps, StatsMatchupTileModel } from "./mc-stats-matchup-tile.types.js";

/**
 * # Matchups tile
 * One hero's or modular set's tile in the Focus view: its picture, a ribbon saying what you did against the villain
 * (the tier beaten, "Tried", "Not played": always in words) and its name. A pairing not beaten stands back, so the wins
 * read first. A focus stop with nothing to press (`tile:<column>`); the picture opens the card popover.
 *
 * @element mc-stats-matchup-tile
 * @prop tile - The tile (`StatsMatchupTileModel`).
 */
export class McStatsMatchupTile extends StatsTileBase implements McStatsMatchupTileProps {
  static override styles = McStatsMatchupTileStyles;

  static override properties: PropertyDeclarations = {
    ...StatsTileBase.properties,
    tile: { attribute: false },
    look: { type: String, reflect: true },
  };

  declare tile: StatsMatchupTileModel | null;
  declare look: string;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.tile = null;
    this.look = "unplayed";
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has("tile")) return;
    this.stop = this.tile ? `tile:${this.tile.column}` : "";
    this.look = this.tile?.look ?? "unplayed";
  }

  protected override updated(): void {
    const art = this.renderRoot.querySelector<HTMLElement>("mc-picture-tile");
    if (!art || this.#unwatch) return;
    this.#unwatch = watchCard(art, () => (this.tile?.cardId ? { cardId: this.tile.cardId } : null));
  }

  override render() {
    const tile = this.tile;
    if (!tile) return nothing;
    return html`<div class="art">
        <mc-picture-tile
          data-card-id=${tile.cardId ?? ""}
          .picture=${tile.picture ?? { src: null }}
          .frame=${0}
          ground="parchment"
        ></mc-picture-tile>
      </div>
      <div class="ribbon" style=${styleMap({ "--tile-color": tile.color, "--tile-ink": tile.ink })}>${tile.ribbon}</div>
      <mc-stats-credited label=${tile.name} .lines=${2}></mc-stats-credited>`;
  }
}
