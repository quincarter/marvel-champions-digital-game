import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsShareStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-start;
    }
    .line {
      font-size: var(--mc-small-12, 12px);
      line-height: 1.35;
      opacity: 0.8;
      max-width: 62ch;
    }
    .on {
      font-weight: 800;
      font-size: var(--mc-small-11, 11px);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
  `,
];
