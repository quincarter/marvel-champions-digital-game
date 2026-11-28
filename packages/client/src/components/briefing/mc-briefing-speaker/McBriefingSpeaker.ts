import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import "../mc-briefing-speech-bubble/mc-briefing-speech-bubble.js";
import { McBriefingSpeakerStyles } from "./mc-briefing-speaker.styles.js";
import type { SpeakerModel } from "./mc-briefing-speaker.types.js";

/**
 * # Briefing speaker
 * Whoever the story briefing line speaks as (a hero, the villain, an NPC, or the first seat for narration): a round portrait with
 * a 3px ink ring, and the speech bubble beside it. A voice with no picture draws its initial rather than somebody else face.
 *
 * @element mc-briefing-speaker
 * @prop model - `SpeakerModel`.
 * @attr phone - The phone size: a 64px portrait instead of 84px.
 */
export class McBriefingSpeaker extends LitElement {
  static override styles = [ThemeStyles, McBriefingSpeakerStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: SpeakerModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const picture = m.portrait.picture;
    return html`<div class="portrait">
        ${
          picture?.src
            ? html`<mc-picture-tile .picture=${picture} ground="ink" .frame=${0}></mc-picture-tile>`
            : m.portrait.initial
              ? html`<span class="initial">${m.portrait.initial.toLocaleUpperCase()}</span>`
              : nothing
        }
      </div>
      <mc-briefing-speech-bubble .text=${m.text} .speaker=${m.speaker ?? ""}></mc-briefing-speech-bubble>`;
  }
}
