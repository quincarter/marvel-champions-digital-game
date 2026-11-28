import { html, LitElement, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { ControlGlyph } from "../../../shared/popup.types.js";
import { ThemeStyles } from "../../../shared/theme.styles.js";
import { McCloseBarStyles } from "./mc-close-bar.styles.js";
import { CLOSE_BAR_ACTION, type McCloseBarProps } from "./mc-close-bar.types.js";

/**
 * # Close bar
 * The ink bar across the top of a learning screen: a close control (a drawn ×, a focus stop), the Bangers title with the
 * Cancel glyph after it while a keyboard or pad is in use, and an end slot (a progress strip). The dark mode tab hangs
 * from the top centre of the screen: the scene asks the shared rule where it goes and tells the bar how far to drop the
 * title and where it must end. The bar's height, padding and title size are custom properties (`--bar-height`,
 * `--bar-pad`, `--title-size`).
 *
 * @element mc-close-bar
 * @attr heading - The title, already translated.
 * @attr close-label - The close control's accessible name.
 * @attr close-stop - The close control's focus stop key (`close`).
 * @prop glyph - The Cancel glyph, or none.
 * @attr drop - Px the title drops under the dark mode tab.
 * @attr max - Px the title may take (0: no limit).
 * @slot end - What sits at the bar's right end.
 * @fires mc-pressed - `PressDetail` with the action `close`.
 */
export class McCloseBar extends LitElement implements McCloseBarProps {
  static override styles = [ThemeStyles, McCloseBarStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    closeLabel: { type: String, attribute: "close-label" },
    closeStop: { type: String, attribute: "close-stop" },
    glyph: { attribute: false },
    drop: { type: Number },
    max: { type: Number },
  };

  declare heading: string;
  declare closeLabel: string;
  declare closeStop: string;
  declare glyph: ControlGlyph | undefined;
  declare drop: number;
  declare max: number;

  constructor() {
    super();
    this.heading = "";
    this.closeLabel = "";
    this.closeStop = "close";
    this.glyph = undefined;
    this.drop = 0;
    this.max = 0;
  }

  override render() {
    const title = styleMap({ "--drop": `${this.drop}px`, "--max": this.max > 0 ? `${this.max}px` : "none" });
    return html`<div class="bar">
      <div class="ctl">
        <mc-chip
          class="close"
          label="×"
          aria-label=${this.closeLabel}
          .stop=${this.closeStop}
          .action=${CLOSE_BAR_ACTION}
        ></mc-chip>
      </div>
      <h1 class="title" style=${title}><span>${this.heading}</span></h1>
      <span class="after"><mc-glyph-hint .glyph=${this.glyph}></mc-glyph-hint></span>
      <div class="end"><slot name="end"></slot></div>
    </div>`;
  }
}
