import { css } from "lit";
import { PressBaseStyles } from "../../../shared/press/press.styles.js";

export const McDottedTermStyles = [
  PressBaseStyles,
  css`
    :host {
      display: inline;
      /* The press area grows past the line to a touch target; an inline box's padding is hit-tested but takes no room. */
      padding: 12px 1px;
    }
    .word {
      text-decoration: underline dotted;
      text-decoration-thickness: 1.5px;
      text-underline-offset: 3px;
      cursor: pointer;
    }
  `,
];
