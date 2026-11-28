import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McGamesSectionStyles = [
  BuilderBaseStyles,
  css`
    :host {
      margin-bottom: 8px;
    }
    .title {
      margin: 0 0 6px;
      padding-bottom: 2px;
      border-bottom: 2px solid currentColor;
      font-family: var(--mc-font-display);
      font-weight: 400;
      font-size: 17px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
];
