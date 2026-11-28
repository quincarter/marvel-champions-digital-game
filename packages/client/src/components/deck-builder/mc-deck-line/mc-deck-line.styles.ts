import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McDeckLineStyles = [
  BuilderBaseStyles,
  css`
    :host {
      padding: 2px 0;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .name {
      flex: 1 1 auto;
      min-width: 0;
      font-size: var(--mc-small-12, 12px);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host([open-on-tap]) .name {
      cursor: pointer;
    }
    .qty {
      flex: none;
      font-size: var(--mc-small-10, 10px);
      font-weight: 700;
      letter-spacing: 0.14em;
      opacity: 0.75;
    }
    mc-button {
      flex: none;
      width: 44px;
      height: 28px;
      --mc-button-size: 16px;
    }
    /* Wrapped, not cut: a campaign note says why a line is pinned, and the end is the point. */
    .note {
      margin-top: 1px;
      font-size: var(--mc-small-9, 9px);
      line-height: 1.3;
      opacity: 0.5;
    }
  `,
];
