import { ThemeStyles } from "@mc/ui";
import { html, LitElement, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import { TROPHY_ROOM_EVENT, type TrophyRoomEventDetail } from "../shared/trophy-room-events.types.js";
import { McTrophyListStyles } from "./mc-trophy-list.styles.js";
import { trophyKeyOf, type McTrophyListProps, type TrophyListModel } from "./mc-trophy-list.types.js";
import "../mc-trophy-family/mc-trophy-family.js";
import "../mc-trophy-group/mc-trophy-group.js";
import "../mc-trophy-tile/mc-trophy-tile.js";

/**
 * # Trophy list
 * Every family's heading and, under an open family, its achievement cards, in one natively scrolling column: a
 * `mc-trophy-family` per family, a `mc-trophy-group` label per pack inside Mods and a `mc-trophy-tile` per achievement
 * (a long list only draws the cards near the view). A tap on a heading says `{ type: "family", id }`, on a card
 * `{ type: "achievement", id }`. Headings and cards are focus stops (`sec:<id>`, `row:<id>`); the focus route scrolls the
 * one it lands on into view.
 *
 * Needs `@mc/ui` defined (`mc-section-heading`, `mc-progress-bar`).
 *
 * @element mc-trophy-list
 * @prop model - The rows (`TrophyListModel`).
 * @attr phone - A slimmer heading and a taller card.
 * @fires mc-trophy-room - `{ type: "family" | "achievement", id }`.
 */
export class McTrophyList extends LitElement implements McTrophyListProps {
  static override styles = [ThemeStyles, McTrophyListStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: TrophyListModel;
  declare phone: boolean;

  constructor() {
    super();
    this.model = { rows: [], groupLabels: {} };
    this.phone = false;
    new FeatureRelay<TrophyRoomEventDetail>(this, TROPHY_ROOM_EVENT);
  }

  /** The list's own scrolling box (the stick and the Page keys move it; the scene keeps and puts back its place). */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".scroller");
  }

  override render() {
    const { rows, groupLabels } = this.model;
    return html`<div class="scroller" tabindex="-1" data-key="list">
      ${repeat(
        rows,
        (row) => trophyKeyOf(row),
        (row) => {
          if (row.kind === "section")
            return html`<mc-trophy-family
              ?phone=${this.phone}
              .stop=${trophyKeyOf(row)}
              .action=${{ type: "family", id: row.id } satisfies TrophyRoomEventDetail}
              .model=${row}
            ></mc-trophy-family>`;
          if (row.kind === "group")
            return html`<mc-trophy-group .model=${row} .label=${groupLabels[row.id] ?? row.title}></mc-trophy-group>`;
          return html`<mc-trophy-tile
            .stop=${trophyKeyOf(row)}
            .action=${{ type: "achievement", id: row.id } satisfies TrophyRoomEventDetail}
            .model=${row}
          ></mc-trophy-tile>`;
        },
      )}
    </div>`;
  }
}
