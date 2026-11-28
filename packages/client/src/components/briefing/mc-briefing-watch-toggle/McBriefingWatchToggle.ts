import { html, type PropertyDeclarations } from "lit";
import { McPress } from "@mc/ui";
import { BriefingPressStyles } from "../shared/briefing.styles.js";
import { McBriefingWatchToggleStyles } from "./mc-briefing-watch-toggle.styles.js";

/**
 * # Briefing watch toggle
 * "Let people watch this game" (#876): a ticked box and its words, one press. The tick and the box say the state, never colour
 * alone. A tap flips it (the press and the lift of a swipe are not a tap, issue #227); the scene stores the flip.
 *
 * @element mc-briefing-watch-toggle
 * @attr label - The words, already translated.
 * @attr checked - Ticked.
 * @attr onink - On the ink action bar: paper words and box.
 * @fires mc-pressed - `PressDetail` whose `action` is `{ type: "watch" }`.
 */
export class McBriefingWatchToggle extends McPress {
  static override styles = [BriefingPressStyles, McBriefingWatchToggleStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    label: { type: String },
    checked: { type: Boolean, reflect: true },
    onink: { type: Boolean, reflect: true },
  };

  declare label: string;
  declare checked: boolean;
  declare onink: boolean;

  constructor() {
    super();
    this.label = "";
    this.checked = false;
    this.onink = false;
    this.action = { type: "watch" };
  }

  override render() {
    return html`<span class="box" aria-hidden="true">${this.checked ? "✓" : ""}</span><span class="words">${this.label}</span>`;
  }
}
