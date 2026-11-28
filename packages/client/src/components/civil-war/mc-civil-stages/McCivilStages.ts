import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import type { StageOptionView, StageRowView } from "../../../view/civil-war-builder-model.js";
import { CIVIL_WAR_EVENT, type CivilPictures, type CivilWarEventDetail } from "../civil-war.types.js";
import { McCivilStagesStyles } from "./mc-civil-stages.styles.js";

/**
 * # Civil War main scheme
 * Step 3: a row per main scheme stage, each offering cards: the stage's printed card (a mouse over it opens the card
 * hover), its name, target threat ("Recommended" in words), a gist and a "Read card ▸" strip. A blind scenario shows the
 * encounter card back and "Stage 2: hidden", never the face. The chosen option is red-bordered. A hold or the strip reads
 * the card in Inspect, with "Choose this stage" when it is not chosen.
 *
 * @element mc-civil-stages
 * @prop rows - `StageRowView[]`.
 * @prop pictures - `CivilPictures`.
 * @attr summary - The sentence under the rows ("Public Outrage, then No Going Back.").
 * @fires mc-civil-war - `act` for an option, `inspect` to read it.
 */
export class McCivilStages extends LitElement {
  static override styles = [McCivilStagesStyles];

  static override properties: PropertyDeclarations = {
    rows: { attribute: false },
    pictures: { attribute: false },
    summary: { type: String },
  };

  declare rows: readonly StageRowView[];
  declare pictures: CivilPictures | null;
  declare summary: string;

  constructor() {
    super();
    this.rows = [];
    this.pictures = null;
    this.summary = "";
    new FeatureRelay<CivilWarEventDetail>(this, CIVIL_WAR_EVENT);
  }

  #read(option: StageOptionView): CivilWarEventDetail | null {
    const face = option.face;
    if (!face) return null;
    return {
      type: "inspect",
      cardId: face.cardId,
      face: face.face,
      ...(option.selected ? {} : { choice: { optionId: option.action, label: "Choose this stage" } }),
    };
  }

  override render() {
    const pictures = this.pictures;
    return html`${this.rows.map(
        (row) =>
          html`<section>
            <h3 class="label">${row.label}</h3>
            ${
              row.hidden
                ? html`<div class="hidden">
                    <mc-picture-tile
                      class="back"
                      .picture=${pictures?.back ?? null}
                      frame="1.5"
                      ground="parchment"
                    ></mc-picture-tile>
                    <span class="name">Stage 2: hidden</span>
                  </div>`
                : html`<div class="options">
                    ${row.options.map(
                      (option) =>
                        html`<div class="option">
                          <mc-press-card
                            .stop=${option.action}
                            ?selected=${option.selected}
                            .action=${{ type: "act", action: option.action } satisfies CivilWarEventDetail}
                            .holdAction=${this.#read(option)}
                          >
                            <div class="face">
                              <mc-card-art
                                .picture=${pictures?.face(option.face) ?? null}
                                .cardId=${option.face?.cardId ?? ""}
                                .face=${option.face?.face}
                              ></mc-card-art>
                            </div>
                            <div class="name">${option.name}</div>
                            <div class="threat">
                              ${option.targetThreat}${option.recommended ? " · Recommended" : nothing}
                            </div>
                            <div class="gist">${option.gist}</div>
                            <span class="read">Read card ▸</span>
                          </mc-press-card>
                          ${
                            option.face
                              ? html`<mc-hit-area class="strip" .action=${this.#read(option)}></mc-hit-area>`
                              : nothing
                          }
                        </div>`,
                    )}
                  </div>`
            }
          </section>`,
      )}
      <p class="summary">${this.summary || "Stage 2 is hidden."}</p>`;
  }
}
