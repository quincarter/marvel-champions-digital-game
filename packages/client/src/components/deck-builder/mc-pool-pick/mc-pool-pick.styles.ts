import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McPoolPickStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    .subtitle {
      margin: 0 0 4px;
      font-size: 13px;
      line-height: 1.45;
      opacity: 0.75;
    }
    mc-button {
      height: 44px;
      --mc-button-size: 12px;
    }
    .all {
      margin-bottom: 8px;
    }
    .head {
      margin: 10px 0 4px 2px;
      font-size: var(--mc-small-10, 10px);
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.6;
    }
    .choice {
      margin-bottom: 6px;
    }
    .done {
      height: 52px;
    }
  `,
];
