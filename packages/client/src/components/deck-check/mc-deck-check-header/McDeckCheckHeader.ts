import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { DeckCheckElement } from "../shared/DeckCheckElement.js";
import "../mc-deck-status-badge/mc-deck-status-badge.js";
import { McDeckCheckHeaderStyles } from "./mc-deck-check-header.styles.js";
import type { DeckCheckSize, McDeckCheckHeaderProps } from "./mc-deck-check-header.types.js";
import type { DeckStatusBadgeTone } from "../mc-deck-status-badge/mc-deck-status-badge.types.js";

/**
 * # Deck check header
 * The ink bar over the screen: Back, the title, and the verdict (a badge on the wide layout, plain words on the
 * narrow ones).
 *
 * @element mc-deck-check-header
 * @fires mc-deck-check - `{ type: "back" }` on a tap on Back.
 */
export class McDeckCheckHeader extends DeckCheckElement implements McDeckCheckHeaderProps {
  static override styles = [ThemeStyles, McDeckCheckHeaderStyles];

  static override properties: PropertyDeclarations = {
    size: { type: String, reflect: true },
    backLabel: { type: String, attribute: "back-label" },
    title: { type: String },
    badgeText: { type: String, attribute: "badge-text" },
    badgeTone: { type: String, attribute: "badge-tone" },
    meta: { type: String },
  };

  declare size: DeckCheckSize;
  declare backLabel: string;
  declare title: string;
  declare badgeText: string;
  declare badgeTone: DeckStatusBadgeTone;
  declare meta: string;

  constructor() {
    super();
    this.size = "wide";
    this.backLabel = "";
    this.title = "";
    this.badgeText = "";
    this.badgeTone = "legal";
    this.meta = "";
  }

  override render() {
    return html`<mc-button
        class="back"
        kind="onInk"
        display
        data-stop="back"
        data-key="back"
        .label=${this.backLabel}
        @mc-press=${() => this.emit({ type: "back" })}
      ></mc-button>
      <div class="title" title=${this.title}>${this.title}</div>
      ${
        this.size === "wide"
          ? this.badgeText
            ? html`<mc-deck-status-badge .text=${this.badgeText} .tone=${this.badgeTone}></mc-deck-status-badge>`
            : nothing
          : html`<div class="meta">${this.meta}</div>`
      }`;
  }
}
