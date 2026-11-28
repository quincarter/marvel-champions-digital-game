import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McPoolSearchStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      gap: 6px;
      height: 44px;
    }
    mc-search-field {
      flex: 1 1 160px;
      min-width: 160px;
    }
    .help {
      flex: none;
      width: 44px;
      --mc-button-size: 16px;
    }
    .view {
      flex: none;
      width: 92px;
    }
    mc-button {
      height: 100%;
    }
  `,
];
