import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseHeaderStyles = [
  PauseBaseStyles,
  css`
    :host {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      color: var(--mc-text-paper);
    }
    .titles {
      flex: 1;
      min-width: 0;
    }
    .title {
      margin: 0;
      font-family: var(--mc-font-display);
      font-weight: 400;
      font-size: 30px;
      line-height: 1.1;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .status {
      margin-top: 4px;
      font-size: var(--mc-small-11, 11px);
      font-weight: 800;
      letter-spacing: 0.14em;
      line-height: 1.35;
      text-transform: uppercase;
      opacity: 0.75;
      overflow-wrap: anywhere;
    }
    .blind {
      margin: 6px 0 0;
      padding: 0;
      list-style: none;
      font-size: var(--mc-small-10, 10px);
      line-height: 1.35;
      opacity: 0.75;
    }
    .note {
      margin-top: 6px;
      font-size: var(--mc-small-11, 11px);
      line-height: 1.3;
      opacity: 0.75;
    }
    .ctl {
      position: relative;
      flex: none;
      width: 44px;
      height: 44px;
      --mc-button-size: 16px;
    }
    mc-button {
      width: 100%;
      height: 100%;
    }
    :host([mode="phone"]) {
      padding-bottom: 10px;
      border-bottom: 2px solid color-mix(in srgb, var(--mc-line-paper) 40%, transparent);
    }
    :host([mode="phone"]) .title {
      font-size: 26px;
    }
    /* A short screen (a phone held sideways): the title and status come closer. */
    @media (max-height: 480px) {
      .title {
        font-size: 22px;
      }
      .status {
        margin-top: 2px;
      }
    }
  `,
];
