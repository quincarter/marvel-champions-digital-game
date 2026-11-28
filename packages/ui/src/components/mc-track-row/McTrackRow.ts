import { html, type PropertyDeclarations } from "lit";
import { McPress } from "../../shared/press/McPress.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McTrackRowStyles } from "./mc-track-row.styles.js";
import type { McTrackRowProps } from "./mc-track-row.types.js";

/**
 * # Track row
 * One song in a list: a red disc (a play triangle, or a note while it plays), the title and where it plays. A tap on it
 * (never the lift that ends a swipe) raises `mc-pressed` with its `action`; the focus route's Enter presses it through
 * `click()`.
 *
 * @element mc-track-row
 * @attr heading - The song's title, already translated.
 * @attr where - Where it plays in the game, already translated.
 * @attr playing - This is the song that is playing: an ink row with a note on its disc (reflected).
 * @attr data-stop - Its focus stop's key.
 * @prop action - What a tap raises.
 * @fires mc-pressed - `PressDetail`.
 */
export class McTrackRow extends McPress implements Omit<McTrackRowProps, "stop" | "action"> {
  static override styles = [ThemeStyles, McTrackRowStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    heading: { type: String },
    where: { type: String },
    playing: { type: Boolean, reflect: true },
  };

  declare heading: string;
  declare where: string;
  declare playing: boolean;

  constructor() {
    super();
    this.heading = "";
    this.where = "";
    this.playing = false;
  }

  override render() {
    return html`<span class="disc" aria-hidden="true">${this.playing ? "♪" : "▶"}</span>
      <div class="text">
        <div class="heading">${this.heading}</div>
        <div class="where">${this.where}</div>
      </div>`;
  }
}
