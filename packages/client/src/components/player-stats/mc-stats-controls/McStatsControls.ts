import { html, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { StatsElement } from "../shared/StatsElement.js";
import type { StatsMode } from "../shared/stats-events.types.js";
import "../mc-stats-chip-row/mc-stats-chip-row.js";
import "../mc-stats-share/mc-stats-share.js";
import { McStatsControlsStyles } from "./mc-stats-controls.styles.js";
import type { McStatsControlsProps, StatsControlRow } from "./mc-stats-controls.types.js";

/**
 * # Stats controls
 * What sits between the tabs and the stats, in order: the filter chips, the Matchups chips, Share my games, a hero or
 * villain stepper, "Hide hero cards". Each row is one of the small elements (a chip row, a stepper, the share line); this
 * only stacks them.
 *
 * @element mc-stats-controls
 * @prop rows - The rows, top to bottom (`StatsControlRow`).
 * @fires mc-player-stats - Whatever a row's controls say.
 */
export class McStatsControls extends StatsElement implements McStatsControlsProps {
  static override styles = McStatsControlsStyles;

  static override properties: PropertyDeclarations = {
    rows: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare rows: readonly StatsControlRow[];
  declare mode: StatsMode;

  constructor() {
    super();
    this.rows = [];
    this.mode = "wide";
  }

  #row(row: StatsControlRow) {
    switch (row.kind) {
      case "chips":
        return html`<mc-stats-chip-row .chips=${row.chips} ?swipe=${row.scroll}></mc-stats-chip-row>`;
      case "stepper":
        return html`<mc-stepper
          label=${row.label}
          prev-stop=${row.prevStop}
          next-stop=${row.nextStop}
          name-stop=${row.nameStop}
          .prevAction=${row.prevAction}
          .nextAction=${row.nextAction}
          .prevGlyph=${row.prevGlyph}
          .nextGlyph=${row.nextGlyph}
          ?several=${row.several}
        ></mc-stepper>`;
      case "share":
        return html`<mc-stats-share .input=${row.input}></mc-stats-share>`;
    }
  }

  override render() {
    return html`${repeat(
      this.rows,
      (row) => row.id,
      (row) => this.#row(row),
    )}`;
  }
}
