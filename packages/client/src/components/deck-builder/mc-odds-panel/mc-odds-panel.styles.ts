import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McOddsPanelStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    mc-stepper {
      width: 100%;
      --stepper-height: var(--odds-height, 44px);
      --stepper-arrow: var(--odds-height, 44px);
    }
    .line {
      margin-top: 2px;
      font-size: var(--mc-small-11, 11px);
      font-weight: 700;
      opacity: 0.8;
    }
    .empty {
      font-size: 13px;
      opacity: 0.5;
    }
  `,
];
