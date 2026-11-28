import type { ControlGlyph } from "@mc/ui";
import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { LearnElement } from "../shared/LearnElement.js";
import { McLearnHeaderStyles } from "./mc-learn-header.styles.js";
import type { LearnHeaderProps, LearnHeaderTicks } from "./mc-learn-header.types.js";

/**
 * # Learn header
 * The ink bar of a learning screen (How to win, How to play): the close ×, the title with its Cancel glyph while a keyboard
 * or pad is in use, and, on How to win, the five-lesson progress ticks at the right. The scene sizes it (`bar-height`,
 * `pad`, `title-size`) and tells it where the dark mode tab leaves room for the title (`drop`, `max`).
 *
 * @element mc-learn-header
 * @attr heading - The title, already translated.
 * @attr close-label - The close control's accessible name.
 * @prop glyph - The Cancel glyph, or none.
 * @prop ticks - The progress strip (`LearnHeaderTicks`), or none.
 * @attr drop - Px the title drops under the dark mode tab.
 * @attr max - Px the title may take (0: no limit).
 * @attr bar-height - The bar's height in px (56).
 * @attr pad - The bar's side padding in px (16).
 * @attr title-size - The title's size in px (22).
 * @fires mc-learn - `{ type: "close" }`.
 */
export class McLearnHeader extends LearnElement implements LearnHeaderProps {
  static override styles = [McLearnHeaderStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    closeLabel: { type: String, attribute: "close-label" },
    glyph: { attribute: false },
    ticks: { attribute: false },
    drop: { type: Number },
    max: { type: Number },
    barHeight: { type: Number, attribute: "bar-height" },
    pad: { type: Number },
    titleSize: { type: Number, attribute: "title-size" },
  };

  declare heading: string;
  declare closeLabel: string;
  declare glyph: ControlGlyph | undefined;
  declare ticks: LearnHeaderTicks | null;
  declare drop: number;
  declare max: number;
  declare barHeight: number;
  declare pad: number;
  declare titleSize: number;

  constructor() {
    super();
    this.heading = "";
    this.closeLabel = "";
    this.glyph = undefined;
    this.ticks = null;
    this.drop = 0;
    this.max = 0;
    this.barHeight = 56;
    this.pad = 16;
    this.titleSize = 22;
  }

  override render() {
    const size = styleMap({
      "--bar-height": `${this.barHeight}px`,
      "--bar-pad": `${this.pad}px`,
      "--title-size": `${this.titleSize}px`,
    });
    return html`<mc-close-bar
      style=${size}
      heading=${this.heading}
      close-label=${this.closeLabel}
      .glyph=${this.glyph}
      drop=${this.drop}
      max=${this.max}
    >
      ${
        this.ticks
          ? html`<mc-step-ticks
              slot="end"
              count=${this.ticks.count}
              filled=${this.ticks.filled}
              label=${this.ticks.label}
            ></mc-step-ticks>`
          : nothing
      }
    </mc-close-bar>`;
  }
}
