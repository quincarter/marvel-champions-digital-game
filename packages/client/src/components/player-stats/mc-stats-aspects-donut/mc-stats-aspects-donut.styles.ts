import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsAspectsDonutStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px 28px;
      padding: 12px 8px 8px;
    }
    mc-donut-chart {
      flex: none;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
      min-width: 0;
      flex: 1 1 260px;
    }
    li {
      display: grid;
      grid-template-columns: 18px minmax(86px, 124px) minmax(0, 1fr);
      align-items: center;
      gap: 10px;
    }
    .swatch {
      width: 18px;
      height: 18px;
      background: var(--swatch);
      border: 2px solid var(--mc-line-ink);
    }
    .name {
      font-size: var(--mc-small-11, 11px);
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .text {
      font-size: 12px;
      opacity: 0.85;
    }
  `,
];
