import { css } from "lit";

export const McSeatsRosterStyles = css`
  :host {
    display: block;
    height: 100%;
    min-height: 0;
  }
  /* The one box that scrolls down: native scrolling, and the container the tiles size against. */
  .scroller {
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    container-type: inline-size;
  }
  .stack {
    --mc-hero-tile-width: clamp(140px, 22cqw, 220px);
    display: block;
    min-width: 0;
  }
  .grid-head {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 12px;
    min-width: 0;
    height: 100%;
  }
  mc-section-header {
    flex: 1;
    min-width: 0;
  }
  .back,
  .clear {
    appearance: none;
    flex: none;
    min-height: 44px;
    margin: 0;
    padding: 0 14px;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--mc-text-ink);
    background: var(--mc-fill-paper);
    border: 2.5px solid var(--mc-line-ink);
    border-radius: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .clear {
    display: block;
    margin: 12px auto;
  }
  @media (hover: hover) {
    .back:hover,
    .clear:hover {
      color: var(--mc-text-paper);
      background: var(--mc-fill-ink);
    }
  }
  .back:focus-visible,
  .clear:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -3px;
  }
`;
