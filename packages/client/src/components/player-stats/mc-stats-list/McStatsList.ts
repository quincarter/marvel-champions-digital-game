import { html, type PropertyDeclarations, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { StatsElement } from "../shared/StatsElement.js";
import "../mc-stats-overview/mc-stats-overview.js";
import "../mc-stats-note/mc-stats-note.js";
import "../mc-stats-row/mc-stats-row.js";
import "../mc-stats-aspects-donut/mc-stats-aspects-donut.js";
import "../mc-stats-aspect-stamps/mc-stats-aspect-stamps.js";
import "../mc-stats-card/mc-stats-card.js";
import "../mc-stats-matchup-shelf/mc-stats-matchup-shelf.js";
import "../mc-stats-matchup-tile/mc-stats-matchup-tile.js";
import { McStatsListStyles } from "./mc-stats-list.styles.js";
import type { McStatsListProps, StatsBlock } from "./mc-stats-list.types.js";

/**
 * # Stats list
 * One tab's content as a natively scrolling column of blocks: the Overview's tiles, headings, notes, stat rows, the
 * Aspects donut, strips of card pictures, and the Matchups key, shelves and tiles. Each block kind is its own element; this
 * only stacks them. Each tab (each hero on Cards by hero, each Matchups view) keeps its own place: the scroll is saved under
 * the old `scrollKey` as the key changes and put back under the new one.
 *
 * @element mc-stats-list
 * @prop blocks - The blocks in order (`StatsBlock`).
 * @attr scroll-key - The tab's scroll name.
 * @fires mc-player-stats - A row's, card's or shelf's press, passed up from the element that raised it.
 */
export class McStatsList extends StatsElement implements McStatsListProps {
  static override styles = McStatsListStyles;

  static override properties: PropertyDeclarations = {
    blocks: { attribute: false },
    scrollKey: { type: String, attribute: "scroll-key" },
  };

  declare blocks: readonly StatsBlock[];
  declare scrollKey: string;
  readonly #places = new Map<string, number>();

  constructor() {
    super();
    this.blocks = [];
    this.scrollKey = "";
  }

  /** The scrolling column: the pad's stick and paging move it. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroller");
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // The old tab's place is read before its blocks go.
    if (changed.has("scrollKey") && changed.get("scrollKey") !== undefined) {
      const scroller = this.scroller;
      if (scroller) this.#places.set(changed.get("scrollKey") as string, scroller.scrollTop);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has("scrollKey")) {
      const scroller = this.scroller;
      if (scroller) scroller.scrollTop = this.#places.get(this.scrollKey) ?? 0;
    }
    this.emitRendered();
  }

  #block(block: StatsBlock) {
    switch (block.kind) {
      case "tiles":
        return html`<mc-stats-overview .tiles=${block.tiles}></mc-stats-overview>`;
      case "heading":
        return html`<mc-section-heading label=${block.title}></mc-section-heading>`;
      case "note":
        return html`<mc-stats-note .text=${block.text}></mc-stats-note>`;
      case "stat":
        return html`<mc-stats-row .stop=${`row:${block.id}`} .row=${block.row}></mc-stats-row>`;
      case "donut":
        return html`<mc-stats-aspects-donut
          chart-key=${block.chartKey}
          caption=${block.caption}
          .shares=${block.shares}
        ></mc-stats-aspects-donut>`;
      case "aspects":
        return html`<mc-stats-aspect-stamps
          caption=${block.caption}
          .aspects=${block.aspects}
        ></mc-stats-aspect-stamps>`;
      case "cards":
        return html`<div class="strip">
          ${block.cards.map((card) => html`<mc-stats-card .card=${card}></mc-stats-card>`)}
        </div>`;
      case "legend":
        return html`<mc-stats-matchup-legend .entries=${block.entries}></mc-stats-matchup-legend>`;
      case "shelf":
        return html`<mc-stats-matchup-shelf .shelf=${block.shelf}></mc-stats-matchup-shelf>`;
      case "matchup-tiles":
        return html`<div class="strip tiles">
          ${block.tiles.map((tile) => html`<mc-stats-matchup-tile .tile=${tile}></mc-stats-matchup-tile>`)}
        </div>`;
    }
  }

  override render() {
    return html`<div class="scroller" data-key="list">
      <div class="blocks">
        ${repeat(
          this.blocks,
          (block) => block.id,
          (block) => this.#block(block),
        )}
      </div>
    </div>`;
  }
}
