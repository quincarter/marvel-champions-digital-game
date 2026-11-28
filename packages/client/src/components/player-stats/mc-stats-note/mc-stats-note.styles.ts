import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsNoteStyles = [
  StatsBaseStyles,
  css`
    :host {
      padding: 8px 4px;
      font-size: var(--mc-small-11, 11px);
      font-weight: 700;
      letter-spacing: 0.06em;
      opacity: 0.7;
      line-height: 1.35;
    }
  `,
];
