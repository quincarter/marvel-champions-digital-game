import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McDeckStatusBadgeStyles } from "./mc-deck-status-badge.styles.js";
import type { DeckStatusBadgeTone, McDeckStatusBadgeProps } from "./mc-deck-status-badge.types.js";

/**
 * # Deck status badge
 * The legality verdict as a filled badge ("40 CARDS · LEGAL"): the colour says legal, illegal or a warning, and the
 * words say it too, so colour is never the only signal.
 *
 * @element mc-deck-status-badge
 */
export class McDeckStatusBadge extends LitElement implements McDeckStatusBadgeProps {
  static override styles = [ThemeStyles, McDeckStatusBadgeStyles];

  static override properties: PropertyDeclarations = {
    text: { type: String },
    tone: { type: String, reflect: true },
  };

  declare text: string;
  declare tone: DeckStatusBadgeTone;

  constructor() {
    super();
    this.text = "";
    this.tone = "legal";
  }

  override render() {
    return html`${this.text}`;
  }
}
