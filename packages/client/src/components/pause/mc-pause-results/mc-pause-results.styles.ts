import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseResultsStyles = [
  PauseBaseStyles,
  css`
    :host {
      color: var(--mc-text-paper);
    }
    .note {
      margin: 14px 0 6px;
      font-size: var(--mc-small-12, 12px);
      line-height: 1.4;
      opacity: 0.8;
    }
    .heading {
      margin: 12px 0 2px;
      font-size: var(--mc-small-11, 11px);
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.75;
    }
    .choice {
      padding: 8px 0 10px;
    }
    .choice-title {
      font-size: var(--mc-small-12, 12px);
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.75;
    }
    .choice-detail {
      margin: 3px 0 8px;
      font-size: var(--mc-small-10, 10px);
      line-height: 1.3;
      opacity: 0.8;
    }
  `,
];
