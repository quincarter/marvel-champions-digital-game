import { css } from "lit";

/** Paper under an ink bar: the rail, the scrolling step and (wide) the review column in a grid, the foot sticky under them. */
export const McCivilWarPageStyles = css`
  :host {
    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: var(--mc-fill-paper);
    background-image: radial-gradient(
      circle,
      color-mix(in srgb, var(--mc-line-ink) 14%, transparent) 1px,
      transparent 1.5px
    );
    background-size: 18px 18px;
    color: var(--mc-text-ink);
    --gutter: 20px;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  :host([mode="phone"]) {
    --gutter: 12px;
  }
  .bar {
    flex: none;
  }
  .main {
    flex: 1 1 0;
    min-height: 0;
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: var(--gutter);
    padding: 12px var(--gutter) 0;
  }
  :host([mode="wide"]) .main {
    grid-template-columns: 240px minmax(0, 1fr) 320px;
  }
  :host([mode="phone"]) .main {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    gap: 8px;
  }
  .rail {
    align-self: start;
  }
  .body {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: 16px;
  }
  .step {
    max-width: 980px;
  }
  .review {
    min-height: 0;
    overflow-y: auto;
  }
  .foot {
    flex: none;
    padding: 10px var(--gutter);
    background: var(--mc-fill-paper);
    border-top: 2px solid var(--mc-line-ink);
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
`;
