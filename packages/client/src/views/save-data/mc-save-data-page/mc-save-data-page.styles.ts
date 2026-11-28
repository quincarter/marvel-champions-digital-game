import { css } from "lit";

/** An ink panel under the ink bar: one column at most 760px wide that scrolls when the step is taller than the screen. */
export const McSaveDataPageStyles = css`
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
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 16px var(--gutter) var(--gutter);
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
`;
