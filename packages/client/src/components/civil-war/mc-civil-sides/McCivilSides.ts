import { html, LitElement, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import type { SideChoice } from "../../../view/civil-war-builder-model.js";
import { CIVIL_WAR_EVENT, type CivilPictures, type CivilWarEventDetail } from "../civil-war.types.js";
import { McCivilSidesStyles } from "./mc-civil-sides.styles.js";

/**
 * # Civil War sides
 * Step 1: the two sides as two cards, each a distinct shape (a square for one, a triangle for the other: never colour
 * alone), the side's name and its leaders (a picture and a name each). The chosen side is the red-bordered card.
 *
 * @element mc-civil-sides
 * @prop sides - `SideChoice[]`.
 * @prop pictures - `CivilPictures`.
 * @fires mc-civil-war - `{ type: "act", action }`.
 */
export class McCivilSides extends LitElement {
  static override styles = [McCivilSidesStyles];

  static override properties: PropertyDeclarations = {
    sides: { attribute: false },
    pictures: { attribute: false },
  };

  declare sides: readonly SideChoice[];
  declare pictures: CivilPictures | null;

  constructor() {
    super();
    this.sides = [];
    this.pictures = null;
    new FeatureRelay<CivilWarEventDetail>(this, CIVIL_WAR_EVENT);
  }

  override render() {
    const pictures = this.pictures;
    return html`${this.sides.map(
      (side, index) =>
        html`<mc-press-card
          .stop=${side.action}
          ?selected=${side.selected}
          .action=${{ type: "act", action: side.action } satisfies CivilWarEventDetail}
        >
          <div class="title">
            <span class=${index === 0 ? "shape square" : "shape triangle"} aria-hidden="true"></span>
            <span class="name">${side.name}</span>
          </div>
          <div class="leaders">
            ${side.leaders.map(
              (leader) =>
                html`<figure>
                  <mc-picture-tile
                    .picture=${pictures?.leader(leader.scenarioId, leader.cardId) ?? null}
                    frame="1.5"
                    ground="parchment"
                  ></mc-picture-tile>
                  <figcaption>${leader.name}</figcaption>
                </figure>`,
            )}
          </div>
        </mc-press-card>`,
    )}`;
  }
}
