import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsAspectStampsStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 18px;
      padding: 6px 0;
    }
    .caption {
      margin-right: 4px;
    }
    .entry {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .stamp {
      padding: 5px 8px;
      background: var(--stamp-fill);
      color: var(--stamp-ink);
      border: 2px solid var(--mc-line-ink);
      font-size: var(--mc-small-11, 11px);
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .detail {
      font-size: 12px;
      opacity: 0.85;
    }
    /* One aspect to a line on a narrow screen. */
    @container (max-width: 600px) {
      :host {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `,
];
