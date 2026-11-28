import { css } from "lit";

export const McSegmentsStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
  }
  .strip {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 4px;
    /* A couple of spare pixels so the last cell's frame stays inside a scrolling parent's clip. */
    padding-right: 2px;
  }
`;
