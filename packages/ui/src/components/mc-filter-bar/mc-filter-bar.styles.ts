import { css } from "lit";

/** Chips side by side, wrapping to the next row; rows past the limit are cut off rather than spilling over the list. */
export const McFilterBarStyles = css`
  :host {
    display: block;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    overflow: hidden;
  }
  .chip {
    display: block;
    flex: 0 0 auto;
    max-width: 100%;
  }
`;
