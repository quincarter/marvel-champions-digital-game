import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsChipRowStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    :host([swipe]) {
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
    }
    :host([swipe])::-webkit-scrollbar {
      display: none;
    }
    .cell {
      position: relative;
      flex: none;
      max-width: 100%;
    }
    mc-chip {
      --chip-height: 44px;
      --chip-size: 18px;
      --chip-pad: 14px;
      --chip-on-fill: var(--mc-fill-red);
      --chip-on-color: var(--mc-text-paper);
      min-width: 56px;
    }
    :host([swipe]) mc-chip {
      --chip-size: 16px;
    }
  `,
];
