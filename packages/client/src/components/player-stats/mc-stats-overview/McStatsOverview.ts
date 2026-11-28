import { html, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { StatsElement } from "../shared/StatsElement.js";
import "../mc-stats-record-tile/mc-stats-record-tile.js";
import "../mc-stats-split-tile/mc-stats-split-tile.js";
import "../mc-stats-figures-tile/mc-stats-figures-tile.js";
import "../mc-stats-portrait-tile/mc-stats-portrait-tile.js";
import "../mc-stats-small-tile/mc-stats-small-tile.js";
import { McStatsOverviewStyles } from "./mc-stats-overview.styles.js";
import type { McStatsOverviewProps, StatsTileModel } from "./mc-stats-overview.types.js";

/**
 * # Stats Overview
 * The first tab: the record, how you lose, the figures of each game, the favorite hero and villain and the small facts, as
 * tiles of a column grid (`tile:<id>` focus stops, nothing to press). Which tile stands where is CSS: the favorite hero
 * stands tall at the left on a wide screen, a banner on a narrow one.
 *
 * @element mc-stats-overview
 * @prop tiles - The tiles in order (`StatsTileModel`).
 */
export class McStatsOverview extends StatsElement implements McStatsOverviewProps {
  static override styles = McStatsOverviewStyles;

  static override properties: PropertyDeclarations = { tiles: { attribute: false } };

  declare tiles: readonly StatsTileModel[];

  constructor() {
    super();
    this.tiles = [];
  }

  #tile(tile: StatsTileModel) {
    const stop = `tile:${tile.id}`;
    switch (tile.kind) {
      case "record":
        return html`<mc-stats-record-tile
          data-kind="record"
          .stop=${stop}
          .caption=${tile.caption}
          .record=${tile.record}
          .rate=${tile.rate}
          .fraction=${tile.fraction}
          .detail=${tile.detail}
        ></mc-stats-record-tile>`;
      case "split":
        return html`<mc-stats-split-tile
          data-kind="split"
          .stop=${stop}
          .label=${tile.label}
          .parts=${tile.parts}
          .detail=${tile.detail}
        ></mc-stats-split-tile>`;
      case "figures":
        return html`<mc-stats-figures-tile
          data-kind="figures"
          .stop=${stop}
          .label=${tile.label}
          .lines=${tile.lines}
        ></mc-stats-figures-tile>`;
      case "portrait":
        return html`<mc-stats-portrait-tile
          data-kind="portrait"
          .stop=${stop}
          .variant=${tile.hero ? "hero" : "stack"}
          .label=${tile.label}
          .name=${tile.name}
          .detail=${tile.detail}
          .extra=${tile.extra}
          .picture=${tile.picture}
        ></mc-stats-portrait-tile>`;
      case "small":
        return html`<mc-stats-small-tile
          data-kind="small"
          .stop=${stop}
          .label=${tile.label}
          .value=${tile.value}
          .detail=${tile.detail}
        ></mc-stats-small-tile>`;
    }
  }

  override render() {
    const showcase = this.tiles.some((tile) => tile.kind === "portrait" && tile.hero);
    return html`<div class=${showcase ? "grid showcase" : "grid"}>
      ${repeat(
        this.tiles,
        (tile) => tile.id,
        (tile) => this.#tile(tile),
      )}
    </div>`;
  }
}
