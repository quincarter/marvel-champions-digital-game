import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McPackSortStyles = [
  BuilderBaseStyles,
  css`
    .stack {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    mc-button {
      height: 44px;
      min-width: 0;
    }
    mc-value-stepper {
      width: 100%;
    }
  `,
];
