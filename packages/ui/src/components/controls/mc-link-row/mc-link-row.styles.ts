import { css } from "lit";
import { PressBaseStyles } from "../../../shared/press/press.styles.js";

export const McLinkRowStyles = [
  PressBaseStyles,
  css`
    :host {
      min-width: 0;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: var(--row-height, 64px);
      padding: 10px 14px 10px 16px;
      background: var(--mc-fill-card);
      border: 1.5px solid var(--mc-line-ink);
    }
    :host([emphasis]) .row {
      border: 2.5px solid var(--mc-fill-caution);
    }
    .text {
      flex: 1;
      min-width: 0;
    }
    .heading {
      font-size: var(--heading-size, 15px);
      font-weight: 800;
      line-height: 1.25;
    }
    .detail {
      margin-top: 3px;
      font-size: 13px;
      line-height: 1.35;
      opacity: 0.75;
    }
    .chev {
      flex: none;
      font-family: var(--mc-font-display);
      font-size: 18px;
    }
    ::slotted([slot="trail"]) {
      flex: none;
    }
  `,
];
