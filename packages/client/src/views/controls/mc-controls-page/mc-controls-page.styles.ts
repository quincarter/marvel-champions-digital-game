import { css } from "lit";

/** An ink panel under the ink bar: the tab rail and status on one line, then a column at most 860px wide that scrolls. */
export const McControlsPageStyles = css`
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
  .tabs {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    width: 100%;
    max-width: calc(860px + var(--gutter) * 2);
    margin: 0 auto;
    padding: 12px var(--gutter) 4px;
  }
  mc-tab-rail {
    flex: 1 1 260px;
    max-width: 360px;
    height: 44px;
  }
  mc-controls-status {
    flex: 1 1 200px;
  }
  .body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 8px var(--gutter) var(--gutter);
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
  }
  .footer {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 12px;
  }
  .footer mc-button {
    width: 200px;
    height: 44px;
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
`;
