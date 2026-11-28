import { css } from "lit";

/**
 * The page: the ink bar over a paper body. Wide, the rail sits beside the doors; stacked (a phone, or a rail too narrow
 * to print every tab), the doors take a row over it. The body is the player (Music only) over one scrolling list.
 */
export const McExtrasPageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--mc-fill-paper);
    --gutter: 24px;
    --bar: 60px;
  }
  :host([phone]) {
    --gutter: 16px;
    --bar: 52px;
  }
  mc-top-bar {
    flex: none;
    height: var(--bar);
  }
  .nav {
    flex: none;
    display: flex;
    align-items: flex-start;
    flex-direction: row-reverse;
    gap: 12px;
    padding: 12px var(--gutter) 0;
  }
  .nav mc-extras-tabs {
    flex: 1 1 0;
    min-width: 0;
  }
  .nav[data-stacked] {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding-top: 10px;
  }
  .body {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 0 var(--gutter) var(--gutter);
  }
  mc-extras-shelf,
  mc-extras-tracks {
    flex: 1 1 0;
    min-height: 60px;
  }
`;
