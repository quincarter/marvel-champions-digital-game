import { css } from "lit";

export const McTermTextStyles = css`
  :host {
    display: block;
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
  }
  /* The tip is placed from this box's corner and must not be clipped by it. */
  .text {
    position: relative;
    font-size: var(--term-size, 14px);
    line-height: 1.5;
  }
  p {
    margin: 0;
  }
  p + p {
    margin-top: 0.6em;
  }
`;
