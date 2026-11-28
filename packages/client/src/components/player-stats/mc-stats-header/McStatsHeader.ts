import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { glyphLabelShift } from "@mc/ui";
import { StatsElement } from "../shared/StatsElement.js";
import type { StatsMode } from "../shared/stats-events.types.js";
import "../mc-stats-source-switch/mc-stats-source-switch.js";
import { McStatsHeaderStyles } from "./mc-stats-header.styles.js";
import type { McStatsHeaderProps, StatsHeaderInput } from "./mc-stats-header.types.js";

/**
 * # Stats header
 * The ink bar over Your stats: Back, the title, "N games played" (wide), and the You / Everyone switch at the right. It
 * leaves room at its centre for the dark mode button.
 *
 * @element mc-stats-header
 * @prop input - What it says (`StatsHeaderInput`).
 * @attr mode - wide | phone.
 * @fires mc-player-stats - `{ type: "back" }` on Back; the switch's `source` event passes through.
 */
export class McStatsHeader extends StatsElement implements McStatsHeaderProps {
  static override styles = McStatsHeaderStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare input: StatsHeaderInput | null;
  declare mode: StatsMode;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<div class="left">
        <div class="ctl" style=${styleMap({ "--mc-label-shift": `${glyphLabelShift(input.backGlyph)}px` })}>
          <mc-button
            class="back"
            kind="onInk"
            display
            data-stop="back"
            data-key="back"
            .label=${input.backLabel}
            @mc-press=${() => this.emit({ type: "back" })}
          ></mc-button>
          <mc-glyph-hint .glyph=${input.backGlyph}></mc-glyph-hint>
        </div>
        <div class="title" title=${input.title}>${input.title}</div>
      </div>
      <div class="right">
        ${input.played ? html`<div class="played">${input.played}</div>` : nothing}
        ${
          input.showSource
            ? html`<mc-stats-source-switch
                .source=${input.source}
                .youLabel=${input.youLabel}
                .everyoneLabel=${input.everyoneLabel}
                .glyph=${input.sourceGlyph}
                ?compact=${this.mode === "phone"}
              ></mc-stats-source-switch>`
            : nothing
        }
      </div>`;
  }
}
