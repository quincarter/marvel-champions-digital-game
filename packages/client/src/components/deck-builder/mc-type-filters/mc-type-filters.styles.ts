import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McTypeFiltersStyles = [
  BuilderBaseStyles,
  css`
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    mc-button {
      flex: 1 1 var(--chip-min, 64px);
      height: 44px;
      min-width: 0;
    }
  `,
];
