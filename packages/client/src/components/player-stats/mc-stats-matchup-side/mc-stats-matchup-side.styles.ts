import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsMatchupSideStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: block;
      width: 240px;
      min-height: 0;
      overflow-y: auto;
      overflow-x: clip;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--mc-fill-ink) 60%, transparent)
        color-mix(in srgb, var(--mc-fill-ink) 12%, transparent);
    }
    .rows {
      display: grid;
      gap: 0;
      padding-right: 6px;
    }
    mc-stats-side-row + mc-stats-side-row {
      margin-top: -2px;
    }
  `,
];
