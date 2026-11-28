import { css } from "lit";
import { PressBaseStyles } from "../../../shared/press/press.styles.js";

export const McSectionHeadingStyles = [
  PressBaseStyles,
  css`
    :host {
      color: var(--mc-text-ink);
    }
    :host([onink]) {
      color: var(--mc-text-paper);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .title {
      font-family: var(--mc-font-display);
      text-transform: uppercase;
      font-size: 19px;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 0 1 auto;
      min-width: 0;
    }
    .rule {
      flex: 1 1 10px;
      height: 3px;
      background: currentColor;
      min-width: 10px;
    }
    .right {
      flex: 0 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      margin-left: 4px;
    }
    .stack {
      margin-top: 2px;
    }
  `,
];
