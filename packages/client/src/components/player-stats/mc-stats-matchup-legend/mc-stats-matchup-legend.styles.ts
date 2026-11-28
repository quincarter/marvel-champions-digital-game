import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsMatchupLegendStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      padding: 2px 0 8px;
    }
    .entry {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      opacity: 0.9;
    }
    .swatch {
      width: 14px;
      height: 14px;
      flex: none;
    }
    .swatch[data-kind="tier"] {
      background: var(--swatch);
    }
    .swatch[data-kind="unplayed"] {
      background: var(--mc-fill-parchment);
    }
    .swatch[data-kind="played"] {
      border: 2px solid var(--mc-line-ink);
    }
  `,
];
