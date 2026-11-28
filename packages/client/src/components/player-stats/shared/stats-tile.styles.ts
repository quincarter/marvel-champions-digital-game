import { css } from "lit";
import { StatsBaseStyles } from "./stats-base.styles.js";

/** What every Overview tile shares: a framed box, parchment (or ink for the headline tiles), laid out by its parent grid. */
export const StatsTileStyles = [
  StatsBaseStyles,
  css`
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      padding: 16px;
      background: var(--mc-fill-parchment);
      border: 2px solid var(--mc-line-ink);
      outline: none;
    }
    :host([dark]) {
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
    }
    @container (max-width: 520px) {
      :host {
        padding: 10px;
      }
    }
  `,
];
