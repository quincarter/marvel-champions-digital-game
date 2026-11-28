import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McBuilderSaveBarStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      gap: 8px;
    }
    mc-button {
      height: 52px;
      --mc-button-size: 14px;
    }
    .save {
      flex: 1 1 auto;
      min-width: 0;
    }
    .review {
      flex: 0 0 36%;
    }
  `,
];
