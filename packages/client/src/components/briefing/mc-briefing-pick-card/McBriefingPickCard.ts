import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import "../mc-briefing-card-thumb/mc-briefing-card-thumb.js";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import { McBriefingPickCardStyles } from "./mc-briefing-pick-card.styles.js";
import type { PickCardModel } from "./mc-briefing-pick-card.types.js";

/**
 * # Briefing pick card
 * One card an option is about (the scheme, the environment it earns, the encounter card it brings, or the card an option
 * is): its picture, with what the card is to the option and its name beside the picture when there is room, and under it
 * when there is not (the words wrap; no measuring). The environment it earns reads green. A tap or hold on the picture opens
 * the card in Inspect and answers nothing. Focus stop: the `stop` it is given.
 *
 * @element mc-briefing-pick-card
 * @prop card - `PickCardModel`.
 * @attr stop - The picture focus stop key.
 * @attr badge - The magnifier badge on the picture.
 * @fires mc-briefing - `{ type: "inspect", cardId, name }`.
 */
export class McBriefingPickCard extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingPickCardStyles];

  static override properties: PropertyDeclarations = {
    card: { attribute: false },
    stop: { type: String },
    badge: { type: Boolean },
  };

  declare card: PickCardModel | null;
  declare stop: string;
  declare badge: boolean;

  constructor() {
    super();
    this.card = null;
    this.stop = "";
    this.badge = false;
    new BriefingRelay(this);
  }

  override render() {
    const card = this.card;
    if (!card) return nothing;
    return html`<mc-briefing-card-thumb
        .stop=${this.stop}
        .card=${{ cardId: card.cardId, name: card.name }}
        .picture=${card.picture}
        shape=${card.shape}
        ?badge=${this.badge}
      ></mc-briefing-card-thumb>
      <div class="words">
        ${card.caption ? html`<span class=${card.earned ? "label heal" : "label quiet"}>${card.caption.toLocaleUpperCase()}</span>` : nothing}
        <span class="name">${card.name}</span>
      </div>`;
  }
}
