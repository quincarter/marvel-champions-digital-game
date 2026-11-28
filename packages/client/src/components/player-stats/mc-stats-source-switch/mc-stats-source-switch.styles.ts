import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

/** The pair sits on the ink bar: the chosen segment is filled Hero Red, the other is an outline in paper. */
export const McStatsSourceSwitchStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: flex;
      flex: none;
    }
    .segment {
      position: relative;
      min-width: var(--segment-width, 96px);
    }
    mc-chip {
      --chip-height: 44px;
      --chip-size: 17px;
      --chip-fill: transparent;
      --chip-color: var(--mc-text-paper);
      --chip-line: var(--mc-text-paper);
      --chip-pad: 6px;
    }
    .segment[data-chosen] mc-chip {
      --chip-fill: var(--mc-fill-red);
      --chip-line: var(--mc-fill-red);
    }
    :host([compact]) {
      --segment-width: 70px;
    }
    :host([compact]) mc-chip {
      --chip-size: 15px;
    }
  `,
];
