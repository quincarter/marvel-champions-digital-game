import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import "../mc-briefing-card-thumb/mc-briefing-card-thumb.js";
import { McBriefingShieldPicturesStyles } from "./mc-briefing-shield-pictures.styles.js";
import type { ShieldPicture } from "./mc-briefing-shield-pictures.types.js";

/**
 * # Briefing shield pictures
 * A wrapped row of card pictures with a few words under each (the evidence the players hold, the Executive Board). Every picture
 * opens Inspect, is its own focus stop (`<key-base>-<index>`) and on desktop opens the card hover popover; the words are text,
 * never colour alone ("3 secrets", "ATTACHMENT").
 *
 * @element mc-briefing-shield-pictures
 * @prop cards - `ShieldPicture[]`.
 * @attr key-base - The stop keys are `<key-base>-<index>`.
 * @attr phone - Smaller pictures.
 * @fires mc-briefing - `{ type: "inspect", cardId, name }`.
 */
export class McBriefingShieldPictures extends LitElement {
  static override styles = [ThemeStyles, McBriefingShieldPicturesStyles];

  static override properties: PropertyDeclarations = {
    cards: { attribute: false },
    keyBase: { type: String, attribute: "key-base" },
    phone: { type: Boolean, reflect: true },
  };

  declare cards: readonly ShieldPicture[];
  declare keyBase: string;
  declare phone: boolean;

  constructor() {
    super();
    this.cards = [];
    this.keyBase = "shield";
    this.phone = false;
    new BriefingRelay(this);
  }

  override render() {
    return html`${this.cards.map(
      (card, index) => html`<div class="cell">
        <mc-briefing-card-thumb
          .stop=${`${this.keyBase}-${index}`}
          .card=${{ cardId: card.cardId as string, name: card.name }}
          .picture=${card.picture}
          badge
        ></mc-briefing-card-thumb>
        <span class="caption">${card.caption.toLocaleUpperCase()}</span>
      </div>`,
    )}`;
  }
}
