import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import { McBriefingSpeechBubbleStyles } from "./mc-briefing-speech-bubble.styles.js";

/**
 * # Briefing speech bubble
 * The white speech bubble of the story line: a 3px ink border, an offset ink shadow and a tail pointing left at the portrait.
 * The speaker is named in Hero Red capitals over the words when the story names one; the bubble is as wide as its words (up to
 * its room) and wraps beyond that.
 *
 * @element mc-briefing-speech-bubble
 * @attr text - The line, already translated.
 * @attr speaker - Who says it, already translated; none for narration.
 */
export class McBriefingSpeechBubble extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingSpeechBubbleStyles];

  static override properties: PropertyDeclarations = {
    text: { type: String },
    speaker: { type: String },
  };

  declare text: string;
  declare speaker: string;

  constructor() {
    super();
    this.text = "";
    this.speaker = "";
  }

  override render() {
    return html`<div class="bubble">
      ${this.speaker ? html`<span class="label red who">${this.speaker.toLocaleUpperCase()}</span>` : nothing}
      <span class="words">${this.text}</span>
    </div>`;
  }
}
