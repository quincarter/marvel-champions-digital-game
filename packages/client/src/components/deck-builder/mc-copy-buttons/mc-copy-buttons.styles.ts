import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McCopyButtonsStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      align-items: center;
      justify-content: var(--copy-justify, space-between);
      gap: var(--copy-gap, 6px);
    }
    mc-button {
      flex: none;
      width: var(--copy-button, 44px);
      height: 44px;
      --mc-button-size: 18px;
    }
    .qty {
      flex: 1 1 auto;
      text-align: center;
      font-family: var(--mc-font-display);
      font-size: 15px;
      letter-spacing: 1px;
      min-width: 0;
    }
    :host([qty-first]) .qty {
      order: -1;
      flex: none;
    }
  `,
];
