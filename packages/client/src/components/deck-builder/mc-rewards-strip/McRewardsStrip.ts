import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McRewardsStripStyles } from "./mc-rewards-strip.styles.js";
import type { RewardsModel } from "./mc-rewards-strip.types.js";

/**
 * # Rewards strip
 * Campaign mode's rewards (MC45 p. 24): every reward the seat chose, in the deck or not, each with its status in words and a
 * button that flips it. A reward left out has no line in the deck list, so this strip is the only place it can be put back.
 * Nothing is drawn when the seat has no reward. The scene writes the choice to the run at once.
 *
 * Focus stops: `reward:<at>:<card id>`.
 *
 * @element mc-rewards-strip
 * @prop model - The rewards (`RewardsModel`).
 * @fires mc-deck-builder - `reward` `{ cardId, included }` (the state it asks for).
 */
export class McRewardsStrip extends BuilderElement {
  static override styles = [ThemeStyles, McRewardsStripStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: RewardsModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const model = this.model;
    if (!model || model.rewards.length === 0) return nothing;
    return html`<div class="label">${model.label}</div>
      ${model.rewards.map(
        (reward, at) =>
          html`<div class="reward">
            <div class="words">
              <div class="name">${reward.name}</div>
              <div class="status">${reward.included ? "✓" : "–"} ${reward.status}</div>
            </div>
            <mc-button
              kind="secondary"
              data-stop=${`reward:${at}:${reward.cardId}`}
              .label=${reward.toggleLabel}
              ?disabled=${reward.disabled !== null}
              .reason=${typeof reward.disabled === "string" ? reward.disabled : ""}
              @mc-press=${this.send({ type: "reward", cardId: reward.cardId, included: !reward.included })}
            ></mc-button>
          </div>`,
      )}`;
  }
}
