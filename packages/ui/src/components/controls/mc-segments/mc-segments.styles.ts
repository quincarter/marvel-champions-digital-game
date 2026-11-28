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
  /* A settings row: the words, then the strip beside them or, when there is no room for both, under them. */
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }
  .text {
    flex: 1 1 240px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: var(--mc-text-paper);
  }
  .heading {
    font-size: var(--mc-small-12, 12px);
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .detail {
    font-size: var(--mc-small-10, 10px);
    line-height: 1.3;
    opacity: 0.8;
  }
  .row .strip {
    flex: 1 1 var(--segments-width, 300px);
    max-width: 100%;
  }
  :host([dimmed]) .row {
    opacity: 0.5;
  }
`;
