import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McRewardsStripStyles = [
  BuilderBaseStyles,
  css`
    :host {
      margin-bottom: 8px;
    }
    .reward {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .words {
      flex: 1 1 auto;
      min-width: 0;
    }
    .name {
      font-family: var(--mc-font-display);
      letter-spacing: 1px;
      text-transform: uppercase;
      font-size: 13px;
      line-height: 1.2;
    }
    .status {
      margin-top: 2px;
      font-size: var(--mc-small-11, 11px);
      opacity: 0.7;
    }
    mc-button {
      flex: none;
      width: min(132px, 40%);
      height: 44px;
    }
  `,
];
