import { css } from "lit";

/** What every Decks section shares: border-box sizing, the pad glyph's wrapper, chips in a wrapping row, the ink rule. */
export const DecksSharedStyles = css`
  :host {
    box-sizing: border-box;
    display: block;
    min-width: 0;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  .ctl {
    position: relative;
    display: flex;
    height: 100%;
    min-width: 0;
  }
  .ctl mc-button {
    flex: 1;
    min-width: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }
  .chip {
    flex: none;
    height: 28px;
  }
  @media (pointer: coarse), (max-width: 1279px) {
    .chip {
      height: 44px;
    }
  }
  .heading {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .heading h2 {
    flex: none;
    margin: 0;
    font-family: var(--mc-font-display);
    font-style: italic;
    font-weight: 400;
    font-size: 19px;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .heading .rule {
    flex: 1;
    min-width: 8px;
    height: 3px;
    background: var(--mc-line-ink);
  }
`;
