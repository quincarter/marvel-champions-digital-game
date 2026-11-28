import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McStartFromStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 560px;
    }
    mc-card-art {
      aspect-ratio: 2.4;
      width: 100%;
      margin-bottom: 6px;
    }
    mc-button {
      height: 52px;
      --mc-button-size: 14px;
    }
    .gap {
      height: 6px;
    }
  `,
];
