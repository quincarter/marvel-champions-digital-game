import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseQuickStyles = [
  PauseBaseStyles,
  css`
    .line {
      display: flex;
      gap: 8px;
    }
    .line > * {
      flex: 1 1 0;
      min-width: 0;
    }
    .toggle {
      flex-grow: 1.35;
      min-height: 44px;
      --mc-button-size: 12px;
    }
    .rows {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      margin-top: 8px;
    }
  `,
];
