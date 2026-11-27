import { css } from "lit";

/**
 * A boxed field in the secondary skin (paper fill, 2.5px ink outline), the typed word in the body role. The size is 16px
 * on a phone so a mobile browser never zooms the page on focus. A focused field shows the heavier ring (Hero Red) and
 * never relies on color alone: its outline thickens.
 */
export const McSearchFieldStyles = css`
  :host {
    display: flex;
    align-items: center;
    background: var(--mc-fill-paper);
    outline: 2.5px solid var(--mc-line-ink);
    outline-offset: -1.25px;
  }
  :host(:focus-within) {
    outline: 4px solid var(--mc-line-red);
    outline-offset: -2px;
  }
  input {
    all: unset;
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    padding: 0 10px;
    font-family: var(--mc-font-body);
    font-size: var(--mc-search-size, 16px);
    color: var(--mc-text-ink);
    -webkit-appearance: none;
  }
  input::placeholder {
    color: var(--mc-text-ink);
    opacity: 0.55;
  }
  input::-webkit-search-cancel-button {
    display: none;
  }
  .clear {
    all: unset;
    box-sizing: border-box;
    flex: none;
    width: 36px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-weight: 800;
    font-size: 16px;
    color: var(--mc-text-ink);
    -webkit-tap-highlight-color: transparent;
  }
`;
