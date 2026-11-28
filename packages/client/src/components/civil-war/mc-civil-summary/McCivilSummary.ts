import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import type { BuilderView } from "../../../view/civil-war-builder-model.js";
import { CIVIL_WAR_EVENT, type CivilPictures, type CivilWarEventDetail } from "../civil-war.types.js";
import { McCivilSummaryStyles } from "./mc-civil-summary.styles.js";

/**
 * # Civil War summary
 * The whole scenario at a glance: the leader's picture with the first facts beside it, the two main scheme stage cards
 * (a mouse over one opens the card hover; a tap reads it), the chosen sets as card pictures, then the rest of the facts. A
 * hidden item (Random and blind) is a card back, never its face, and the caption says "Hidden".
 *
 * @element mc-civil-summary
 * @prop view - `BuilderView`.
 * @prop pictures - `CivilPictures`.
 * @fires mc-civil-war - `inspect` to read a stage.
 */
export class McCivilSummary extends LitElement {
  static override styles = [McCivilSummaryStyles];

  static override properties: PropertyDeclarations = {
    view: { attribute: false },
    pictures: { attribute: false },
  };

  declare view: BuilderView | null;
  declare pictures: CivilPictures | null;

  constructor() {
    super();
    this.view = null;
    this.pictures = null;
    new FeatureRelay<CivilWarEventDetail>(this, CIVIL_WAR_EVENT);
  }

  override render() {
    const view = this.view;
    const pictures = this.pictures;
    if (!view || !pictures) return nothing;
    const art = view.summaryArt;
    return html`<div class="head">
        <mc-picture-tile
          class="leader"
          .picture=${pictures.leader(art.leader.scenarioId, art.leader.cardId)}
          frame="1.5"
          ground="parchment"
        ></mc-picture-tile>
        <div class="lines">
          ${view.summary.slice(0, 3).map((line, index) => html`<p class=${index === 0 ? "first" : ""}>${line}</p>`)}
        </div>
      </div>
      <div class="stages">
        ${art.stages.map((stage) =>
          stage.hidden
            ? html`<figure>
                <mc-picture-tile
                  class="back"
                  .picture=${pictures.back}
                  frame="1.5"
                  ground="parchment"
                ></mc-picture-tile>
                <figcaption>Hidden</figcaption>
              </figure>`
            : html`<figure>
                <div class="card">
                  <mc-card-art
                    .picture=${pictures.face(stage.face)}
                    .cardId=${stage.face?.cardId ?? ""}
                    .face=${stage.face?.face}
                  ></mc-card-art>
                  ${
                    stage.face
                      ? html`<mc-hit-area
                          class="over"
                          .action=${
                            {
                              type: "inspect",
                              cardId: stage.face.cardId,
                              face: stage.face.face,
                            } satisfies CivilWarEventDetail
                          }
                        ></mc-hit-area>`
                      : nothing
                  }
                </div>
                <figcaption>${stage.name}</figcaption>
              </figure>`,
        )}
      </div>
      <div class="sets">
        ${
          art.setsHidden
            ? Array.from(
                { length: art.setCount },
                () =>
                  html`<mc-picture-tile
                    class="set"
                    .picture=${pictures.back}
                    frame="1"
                    ground="parchment"
                  ></mc-picture-tile>`,
              )
            : art.sets.map(
                (set) =>
                  html`<mc-card-art
                    class="set"
                    .picture=${pictures.face(set.faces[0] ?? null)}
                    .cardId=${set.faces[0]?.cardId ?? ""}
                    .face=${set.faces[0]?.face}
                  ></mc-card-art>`,
              )
        }
      </div>
      <div class="facts">
        ${view.summary.slice(3).map((line) => html`<p>${line}</p>`)}
        ${view.expertNote ? html`<p>${view.expertNote}</p>` : nothing}
      </div>`;
  }
}
