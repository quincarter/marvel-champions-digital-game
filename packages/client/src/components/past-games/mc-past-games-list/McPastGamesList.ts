import { ThemeStyles } from "@mc/ui";
import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import { PastGamesElement } from "../shared/PastGamesElement.js";
import { PAST_GAMES_EVENT, type PastGamesEventDetail } from "../shared/past-games-events.types.js";
import { McPastGamesListStyles } from "./mc-past-games-list.styles.js";
import type { McPastGamesListProps, PastGamesListModel } from "./mc-past-games-list.types.js";
import "../mc-past-game-row/mc-past-game-row.js";

/**
 * # Past games list
 * The finished games, newest first, in a natively scrolling column: one `mc-past-game-row` per game (a long history only
 * draws the rows near the view), or one sentence when there are none to show. A tap on a row says
 * `{ type: "select", id }`. Rows are focus stops (`game:<id>`); the focus route scrolls the one it lands on into view.
 *
 * Needs `@mc/ui` defined (`mc-empty-state`, `mc-picture-tile`).
 *
 * @element mc-past-games-list
 * @prop model - The rows or the empty sentence (`PastGamesListModel`).
 * @fires mc-past-games - `{ type: "select", id }`.
 */
export class McPastGamesList extends PastGamesElement implements McPastGamesListProps {
  static override styles = [ThemeStyles, McPastGamesListStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: PastGamesListModel;

  constructor() {
    super();
    this.model = { rows: [], empty: null };
    new FeatureRelay<PastGamesEventDetail>(this, PAST_GAMES_EVENT);
  }

  /** The list's own scrolling box (the stick and the Page keys move it; the scene keeps and puts back its place). */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroller");
  }

  /** Scrolls a game's row to the middle of the list (a linked game, once its row exists). */
  centerRow(id: string): void {
    const row = [...this.renderRoot.querySelectorAll<HTMLElement>("mc-past-game-row")].find(
      (el) => el.dataset.stop === `game:${id}`,
    );
    row?.scrollIntoView({ block: "center" });
  }

  override render() {
    const { rows, empty } = this.model;
    if (empty !== null) return html`<mc-empty-state align="center" size="11" .message=${empty}></mc-empty-state>`;
    return html`<div class="scroller" tabindex="-1" data-key="list">
      ${
        rows.length === 0
          ? nothing
          : repeat(
              rows,
              (row) => row.id,
              (row) =>
                html`<mc-past-game-row
                  .stop=${`game:${row.id}`}
                  .action=${{ type: "select", id: row.id } satisfies PastGamesEventDetail}
                  .model=${row}
                  ?selected=${row.selected}
                ></mc-past-game-row>`,
            )
      }
    </div>`;
  }
}
