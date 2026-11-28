import { html, LitElement, type PropertyDeclarations } from "lit";
import type { TrophyState } from "../../../view/trophy-room-model.js";
import { McTrophyStateStyles } from "./mc-trophy-state.styles.js";
import type { McTrophyStateProps } from "./mc-trophy-state.types.js";

/**
 * # Trophy state
 * An achievement's state as a word and a mark, never colour alone: EARNED (a filled chip with a check), LOCKED (an outline)
 * or SOON (a dashed, dimmed outline: tracked from a future update). The chip takes the colour of the card around it.
 *
 * @element mc-trophy-state
 * @attr state - earned | locked | untracked.
 * @attr label - The word, already translated.
 */
export class McTrophyState extends LitElement implements McTrophyStateProps {
  static override styles = [McTrophyStateStyles];

  static override properties: PropertyDeclarations = {
    state: { type: String, reflect: true },
    label: { type: String },
  };

  declare state: TrophyState;
  declare label: string;

  constructor() {
    super();
    this.state = "locked";
    this.label = "";
  }

  override render() {
    return html`<span class="chip">${this.state === "earned" ? "✓ " : ""}${this.label}</span>`;
  }
}
