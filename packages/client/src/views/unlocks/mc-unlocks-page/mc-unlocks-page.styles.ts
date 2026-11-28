import { css } from "lit";

/** An ink panel under the ink bar: one column at most 760px wide, the list taking what the points and switches leave. */
export const McUnlocksPageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    --gutter: 24px;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  :host([phone]) {
    --gutter: 16px;
  }
  .bar {
    flex: none;
  }
  .body {
    flex: 1 1 0;
    min-height: 0;
    padding: 14px var(--gutter) var(--gutter);
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 760px;
    height: 100%;
    margin: 0 auto;
  }
  .content > * {
    flex: none;
  }
  mc-unlocks-list,
  mc-unlocks-guide {
    flex: 1 1 0;
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
`;
