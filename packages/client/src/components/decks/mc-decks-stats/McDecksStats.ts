import { html, nothing, type PropertyDeclarations } from "lit";
import { DecksElement } from "../shared/DecksElement.js";
import { DecksSharedStyles } from "../shared/decks-shared.styles.js";
import type { DecksDeckBody, DecksDeckStatsModel, DecksStatsModel } from "../decks.types.js";
import "../mc-decks-card-view/mc-decks-card-view.js";
import "../mc-decks-community/mc-decks-community.js";
import "../mc-decks-games/mc-decks-games.js";
import { McDecksStatsStyles } from "./mc-decks-stats.styles.js";

/** The chart's whole height, labels included. */
const CHART_HEIGHT = 84;

/**
 * # Decks stats
 * The ink rail of the selected deck (the wide layout's third pane, the narrow layout's Stats tab): its name, one meta line and
 * the credit of a community deck it was copied from; then, under the "This deck / From your games" tabs, either the deck's own
 * numbers (the cost curve as a bar chart, the composition as stat tiles, Check / Edit / Delete, when it last changed) or the
 * games view (`mc-decks-games`); or a pool card in their place (`mc-decks-card-view`). Duplicate and the single red "Play this
 * deck" are pinned at the foot. A community deck shows its own rail (`mc-decks-community`); with no deck selected the pane
 * says so.
 *
 * Focus stops: `pane:deck`, `pane:games`, `stats-check`, `stats-edit`, `stats-delete`, `stats-duplicate`, `stats-play`, and
 * the children's.
 *
 * @element mc-decks-stats
 * @prop model - The rail (`DecksStatsModel`).
 * @fires mc-decks - `{ type: "action", action }` for the tabs and buttons, and the children's events as they bubble.
 */
export class McDecksStats extends DecksElement {
  static override styles = [DecksSharedStyles, McDecksStatsStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DecksStatsModel | null;

  constructor() {
    super();
    this.model = null;
  }

  #deck(body: DecksDeckBody) {
    return html`<section class="block">
        <h3>${body.curveHeading}</h3>
        <mc-bar-chart .bars=${body.bars} .height=${CHART_HEIGHT}></mc-bar-chart>
      </section>
      <section class="block">
        <h3>${body.compositionHeading}</h3>
        <div class="tiles">
          ${body.tiles.map((tile) => html`<mc-stat-tile .text=${`${tile.label} ${tile.count}`}></mc-stat-tile>`)}
        </div>
      </section>
      <div class="actions">${body.actions.map((action) => this.button(action, { kind: "quiet", size: 11 }))}</div>
      <section class="block">
        <h3>${body.recentlyHeading}</h3>
        <p class="recently">${body.recently}</p>
      </section>`;
  }

  #rail(stats: DecksDeckStatsModel) {
    return html`<div class="head">
        <h2 class="title">${stats.title}</h2>
        <span class="meta">${stats.meta}</span>
        ${stats.credit ? html`<span class="meta">${stats.credit}</span>` : nothing}
      </div>
      ${
        stats.mode === "card" && stats.card
          ? html`<mc-decks-card-view class="view" .model=${stats.card}></mc-decks-card-view>`
          : html`<div class="tabs">
                ${stats.tabs.map((tab) =>
                  this.button(
                    { action: tab.action, label: tab.label, glyph: tab.glyph },
                    {
                      kind: tab.selected ? "primary" : "onInk",
                      stop: tab.action === "pane-deck" ? "pane:deck" : "pane:games",
                      size: 11,
                    },
                  ),
                )}
              </div>
              ${
                stats.mode === "games" && stats.games
                  ? html`<mc-decks-games class="view" .model=${stats.games}></mc-decks-games>`
                  : html`<div class="view body">${this.#deck(stats.deck)}</div>`
              }`
      }
      <div class="foot">
        <div class="duplicate">${this.button(stats.footer.duplicate, { kind: "onInk" })}</div>
        <div class="play">${this.button(stats.footer.play, { kind: "primary", display: true })}</div>
      </div>`;
  }

  override render() {
    const stats = this.model;
    if (!stats) return nothing;
    if (stats.kind === "empty") return html`<p class="select">${stats.text}</p>`;
    if (stats.kind === "community") return html`<mc-decks-community .model=${stats}></mc-decks-community>`;
    return this.#rail(stats);
  }
}
