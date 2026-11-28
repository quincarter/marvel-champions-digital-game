import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McBriefingKickerStyles } from "./mc-briefing-kicker.styles.js";
import type { KickerTone } from "./mc-briefing-kicker.types.js";

/**
 * # Briefing kicker
 * A short label in capitals over a row or a block (a mission's kind, "EVIDENCE · 1 GAINED"): the small tracked line, in
 * Hero Red, the blue of a held value, green, or the quiet ink. The words are capitalised here, so a spec reading the page
 * sees the capitals the player does.
 *
 * @element mc-briefing-kicker
 * @attr text - The words, already translated.
 * @attr tone - `red` (default) | `cost` | `heal` | `ink`.
 */
export class McBriefingKicker extends LitElement {
  static override styles = [ThemeStyles, McBriefingKickerStyles];

  static override properties: PropertyDeclarations = {
    text: { type: String },
    tone: { type: String, reflect: true },
  };

  declare text: string;
  declare tone: KickerTone;

  constructor() {
    super();
    this.text = "";
    this.tone = "red";
  }

  override render() {
    return html`<span>${this.text.toLocaleUpperCase()}</span>`;
  }
}
