import { html, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { glyphLabelShift } from "@mc/ui";
import { StatsElement } from "../shared/StatsElement.js";
import { McStatsChipRowStyles } from "./mc-stats-chip-row.styles.js";
import type { McStatsChipRowProps, StatsChipModel } from "./mc-stats-chip-row.types.js";

/**
 * # Chip row
 * A row of chips (`mc-chip`): the filters, the Matchups views and toggles, "Hide hero cards". Each chip is a focus stop
 * under its own key and says what its press means as one `mc-player-stats` event; a chip that is on is filled. A phone's
 * row swipes sideways instead of wrapping.
 *
 * @element mc-stats-chip-row
 * @prop chips - The chips, in order (`StatsChipModel`).
 * @attr swipe - One swiping row.
 * @fires mc-player-stats - The pressed chip's `action`.
 */
export class McStatsChipRow extends StatsElement implements McStatsChipRowProps {
  static override styles = McStatsChipRowStyles;

  static override properties: PropertyDeclarations = {
    chips: { attribute: false },
    swipe: { type: Boolean, reflect: true },
  };

  declare chips: readonly StatsChipModel[];
  declare swipe: boolean;

  constructor() {
    super();
    this.chips = [];
    this.swipe = false;
  }

  override render() {
    return html`${repeat(
      this.chips,
      (chip) => chip.key,
      (chip) =>
        html`<div class="cell" style=${styleMap({ "--mc-label-shift": `${glyphLabelShift(chip.glyph)}px` })}>
          <mc-chip
            label=${chip.label}
            ?selected=${chip.selected}
            .stop=${chip.key}
            .action=${chip.action}
            aria-pressed=${chip.selected ? "true" : "false"}
          ></mc-chip>
          <mc-glyph-hint .glyph=${chip.glyph}></mc-glyph-hint>
        </div>`,
    )}`;
  }
}
