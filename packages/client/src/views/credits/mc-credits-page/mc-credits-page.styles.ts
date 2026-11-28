import { css } from "lit";

export const McCreditsPageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--mc-fill-paper);
    color: var(--mc-text-ink);
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
    height: 60px;
  }
  :host([phone]) .bar {
    height: 52px;
  }
  .body {
    flex: 1 1 0;
    min-height: 0;
    padding: 12px var(--gutter) var(--gutter);
  }
  mc-credits-list {
    display: block;
    height: 100%;
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
`;
