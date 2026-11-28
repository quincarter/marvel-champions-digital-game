import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import type { LeaderChoice } from "../../../view/civil-war-builder-model.js";
import { CIVIL_WAR_EVENT, type CivilPictures, type CivilWarEventDetail } from "../civil-war.types.js";
import { McCivilLeadersStyles } from "./mc-civil-leaders.styles.js";

/**
 * # Civil War leaders
 * Step 2: one card per leader on the chosen side: the leader's picture, name, the stages this difficulty plays (hit points
 * for each), the Expert note and the set that is always in. The card is the choice (red border when chosen); each stage's
 * printed card sits under it with a "Read stage ▸" button, a mouse over it opens the card hover and a hold on the card
 * reads its first stage. Reading a card that is not chosen offers "Choose this leader" in Inspect.
 *
 * @element mc-civil-leaders
 * @prop leaders - `LeaderChoice[]`.
 * @prop pictures - `CivilPictures`.
 * @attr expert-note - Shown on each card in Expert, or empty.
 * @fires mc-civil-war - `act` for a leader, `inspect` to read a stage.
 */
export class McCivilLeaders extends LitElement {
  static override styles = [McCivilLeadersStyles];

  static override properties: PropertyDeclarations = {
    leaders: { attribute: false },
    pictures: { attribute: false },
    expertNote: { type: String, attribute: "expert-note" },
  };

  declare leaders: readonly LeaderChoice[];
  declare pictures: CivilPictures | null;
  declare expertNote: string;

  constructor() {
    super();
    this.leaders = [];
    this.pictures = null;
    this.expertNote = "";
    new FeatureRelay<CivilWarEventDetail>(this, CIVIL_WAR_EVENT);
  }

  #read(leader: LeaderChoice, index: number): CivilWarEventDetail | null {
    const face = leader.stages[index]?.face;
    if (!face) return null;
    return {
      type: "inspect",
      cardId: face.cardId,
      face: face.face,
      ...(leader.selected ? {} : { choice: { optionId: leader.action, label: "Choose this leader" } }),
    };
  }

  override render() {
    const pictures = this.pictures;
    return html`${this.leaders.map(
      (leader) =>
        html`<div class="leader">
          <mc-press-card
            .stop=${leader.action}
            ?selected=${leader.selected}
            .action=${{ type: "act", action: leader.action } satisfies CivilWarEventDetail}
            .holdAction=${this.#read(leader, 0)}
          >
            <div class="top">
              <mc-picture-tile
                class="portrait"
                .picture=${pictures?.leader(leader.scenarioId, leader.cardId) ?? null}
                frame="1.5"
                ground="parchment"
              ></mc-picture-tile>
              <div class="facts">
                <div class="name">${leader.name}</div>
                <div class="word">${leader.word}</div>
                ${leader.stages.map((stage) => html`<div class="stage">Stage ${stage.numeral}: ${stage.hp} HP</div>`)}
                ${this.expertNote ? html`<div class="note">${this.expertNote}</div>` : nothing}
              </div>
            </div>
            <div class="always">Always in: ${leader.ownSet}</div>
          </mc-press-card>
          <div class="faces">
            ${leader.stages.map(
              (stage, index) =>
                html`<div class="face">
                  <mc-card-art
                    .picture=${pictures?.face(stage.face) ?? null}
                    .cardId=${stage.face?.cardId ?? ""}
                    .face=${stage.face?.face}
                  ></mc-card-art>
                  ${
                    this.#read(leader, index)
                      ? html`<mc-hit-area class="over" .action=${this.#read(leader, index)}></mc-hit-area>`
                      : nothing
                  }
                  <span class="read">Read stage ${stage.numeral} ▸</span>
                </div>`,
            )}
          </div>
        </div>`,
    )}`;
  }
}
