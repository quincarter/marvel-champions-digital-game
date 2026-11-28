import { css } from "lit";

export const McSeatsFooterStyles = css`
  :host {
    display: block;
    color: var(--mc-text-paper);
  }
  .foot {
    display: flex;
    flex-direction: row;
    gap: 10px;
  }
  :host([wide]) .foot {
    flex-direction: column;
    gap: 8px;
  }
  button {
    appearance: none;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 52px;
    margin: 0;
    padding: 0 12px;
    font-family: var(--mc-font-display);
    font-style: italic;
    font-size: 20px;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible {
    outline: 3px solid var(--mc-line-paper);
    outline-offset: 2px;
  }
  .deck-check {
    flex: none;
    width: 140px;
    background: none;
    color: inherit;
    border: 2px solid var(--mc-line-paper);
  }
  :host([wide]) .deck-check {
    width: auto;
  }
  .deck-check[disabled] {
    opacity: 0.45;
    border-style: dashed;
    cursor: not-allowed;
  }
  .play {
    flex: 1;
    min-width: 0;
    background: var(--mc-fill-red);
    color: var(--mc-text-on-red, var(--mc-text-paper));
    border: 3px solid var(--mc-line-paper);
  }
  .play[aria-disabled="true"] {
    opacity: 0.6;
    border-style: dashed;
  }
  .word {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
