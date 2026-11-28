import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { CardWatchController } from "../card-watch.controller.js";
import { McLobbyPlanStyles } from "./mc-lobby-plan.styles.js";
import type { LobbyPlanModel } from "./mc-lobby-plan.types.js";

/**
 * # Lobby table plan
 * "The table": what the host picked, so everyone knows what they are up against. A heading, the facts line (difficulty,
 * Heroic, Skirmish) and the villain and each modular set as a picture with its name under it. A picture that names a
 * card is a card picture (`watchCard`): the mouse over it opens the card popover and a hold inspects it. With no
 * modular set, `noSets` says so.
 *
 * @element mc-lobby-plan
 * @prop model - The plan (`LobbyPlanModel`); null draws nothing.
 * @fires mc-card-hover - See `watchCard`.
 * @fires mc-card-hover-end - See `watchCard`.
 * @fires mc-card-inspect - See `watchCard`.
 */
export class McLobbyPlan extends LitElement {
  static override styles = [McLobbyPlanStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LobbyPlanModel | null;

  constructor() {
    super();
    this.model = null;
    new CardWatchController(this);
  }

  override render() {
    const plan = this.model;
    if (!plan) return nothing;
    return html`<mc-section-heading .label=${plan.heading}></mc-section-heading>
      <p class="facts">${plan.facts}</p>
      <ul class="grid">
        ${repeat(
          plan.items,
          (item) => item.key,
          (item) =>
            html`<li class="item" data-key=${`plan:${item.key}`}>
              <mc-picture-tile
                class="pic"
                .picture=${item.picture}
                .frame=${2}
                data-card=${item.cardId ?? ""}
                data-face=${item.face ?? ""}
              ></mc-picture-tile>
              <span class="name">${item.name}</span>
            </li>`,
        )}
      </ul>
      ${plan.noSets ? html`<p class="none">${plan.noSets}</p>` : nothing}`;
  }
}
