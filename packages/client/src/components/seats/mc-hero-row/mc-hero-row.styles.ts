import { css } from "lit";

export const McHeroRowStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }
  slot[name="head"] {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 44px;
  }
  .chevrons {
    display: none;
    flex: none;
    align-items: center;
    gap: 4px;
  }
  @media (pointer: fine) {
    .chevrons {
      display: flex;
    }
  }
  /* A pad is in use for this shelf: the buttons and the trigger glyphs show wherever the pointer is. */
  .chevrons.hinted {
    display: flex;
  }
  /* Real buttons beside the row: a keyboard reaches them and Enter or Space presses them. */
  .chev {
    appearance: none;
    width: 44px;
    height: 44px;
    margin: 0;
    padding: 0;
    font: 800 24px var(--mc-font-body);
    line-height: 1;
    color: var(--mc-text-ink);
    background: var(--mc-fill-paper);
    border: 2.5px solid var(--mc-line-ink);
    border-radius: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) {
    .chev:hover {
      color: var(--mc-text-paper);
      background: var(--mc-fill-ink);
    }
  }
  .chev:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -3px;
  }
  .hint {
    pointer-events: none;
  }
  .row {
    display: flex;
    gap: var(--mc-hero-tile-gap, 12px);
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    padding: 4px 4px 4px 0;
  }
  .row::-webkit-scrollbar {
    display: none;
  }
  :host([wrap]) .row {
    flex-wrap: wrap;
    overflow: visible;
    padding-bottom: 20px;
  }
`;
