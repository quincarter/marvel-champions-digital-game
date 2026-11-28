import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseTableStyles = [
  PauseBaseStyles,
  css`
    :host {
      color: var(--mc-text-paper);
    }
    .run {
      height: 44px;
      margin-bottom: 8px;
      --mc-button-size: 12px;
    }
    .run mc-button {
      width: 100%;
      height: 100%;
    }
    .heading {
      margin: 14px 0 4px;
      font-size: var(--mc-small-11, 11px);
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.75;
    }
    .choice {
      margin: 4px 0 8px;
    }
    .choice-title {
      margin-bottom: 6px;
      font-size: var(--mc-small-12, 12px);
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
  `,
];
