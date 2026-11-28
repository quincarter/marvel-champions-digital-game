import { html, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { glyphLabelShift, type ControlGlyph } from "@mc/ui";
import { StatsElement } from "../shared/StatsElement.js";
import type { StatsSourceName } from "../shared/stats-events.types.js";
import { McStatsSourceSwitchStyles } from "./mc-stats-source-switch.styles.js";
import type { McStatsSourceSwitchProps } from "./mc-stats-source-switch.types.js";

/**
 * # Source switch
 * The You / Everyone pair in the ink bar: two segments, one at a time, the chosen one filled. The segment that is not
 * chosen wears the glyph of the key or button that switches (View on a pad, Shift+B on a keyboard). Each is a focus stop
 * (`source:you`, `source:everyone`).
 *
 * @element mc-stats-source-switch
 * @fires mc-player-stats - `{ type: "source", source }`.
 */
export class McStatsSourceSwitch extends StatsElement implements McStatsSourceSwitchProps {
  static override styles = McStatsSourceSwitchStyles;

  static override properties: PropertyDeclarations = {
    source: { type: String, reflect: true },
    youLabel: { type: String, attribute: "you-label" },
    everyoneLabel: { type: String, attribute: "everyone-label" },
    glyph: { attribute: false },
    compact: { type: Boolean, reflect: true },
  };

  declare source: StatsSourceName;
  declare youLabel: string;
  declare everyoneLabel: string;
  declare glyph: ControlGlyph | undefined;
  /** Narrow segments, for a phone's bar. */
  declare compact: boolean;

  constructor() {
    super();
    this.source = "you";
    this.youLabel = "";
    this.everyoneLabel = "";
    this.glyph = undefined;
    this.compact = false;
  }

  #segment(which: StatsSourceName, label: string) {
    const chosen = this.source === which;
    const glyph = chosen ? undefined : this.glyph;
    return html`<div
      class="segment"
      ?data-chosen=${chosen}
      style=${styleMap({ "--mc-label-shift": `${glyphLabelShift(glyph)}px` })}
    >
      <mc-chip
        label=${label}
        .stop=${`source:${which}`}
        .action=${{ type: "source", source: which }}
        aria-pressed=${chosen ? "true" : "false"}
      ></mc-chip>
      <mc-glyph-hint .glyph=${glyph}></mc-glyph-hint>
    </div>`;
  }

  override render() {
    return html`${this.#segment("you", this.youLabel)}${this.#segment("everyone", this.everyoneLabel)}`;
  }
}
