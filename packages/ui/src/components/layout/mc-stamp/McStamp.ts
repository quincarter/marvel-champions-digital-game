import { html, LitElement, type PropertyDeclarations } from "lit";
import { McStampStyles } from "./mc-stamp.styles.js";
import type { McStampProps, McStampTone } from "./mc-stamp.types.js";

/**
 * # Stamp
 * A small capitals tag on a flat fill: WIN, LOSE, NEXT, RECOMMENDED, or a lesson's name in a chip. The word is the
 * meaning and the tone only the look, so it never rests on colour alone. Decorative: the part that holds it takes any
 * press.
 *
 * @element mc-stamp
 * @attr label - The word, already translated.
 * @attr tone - heal | red | caution | ink | parchment (default): the fill and the ink on it.
 */
export class McStamp extends LitElement implements McStampProps {
  static override styles = [McStampStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    tone: { type: String, reflect: true },
  };

  declare label: string;
  declare tone: McStampTone;

  constructor() {
    super();
    this.label = "";
    this.tone = "parchment";
  }

  override render() {
    return html`<span class="word">${this.label}</span>`;
  }
}
