import { css } from "lit";
import { LearnListStyles } from "../shared/learn-list.styles.js";

export const McLinkListStyles = [
  LearnListStyles,
  css`
    :host([columns="2"]) .rows {
      grid-template-columns: 1fr 1fr;
      column-gap: var(--column-gap, 24px);
    }
  `,
];
