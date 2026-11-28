import { css } from "lit";
import { PressBaseStyles } from "../../../shared/press/press.styles.js";

export const McHitAreaStyles = [
  PressBaseStyles,
  css`
    :host {
      position: absolute;
      z-index: 1;
      cursor: pointer;
    }
  `,
];
