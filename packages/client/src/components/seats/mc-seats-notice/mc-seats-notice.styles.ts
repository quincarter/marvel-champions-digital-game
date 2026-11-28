import { css } from "lit";

export const McSeatsNoticeStyles = css`
  :host {
    display: block;
  }
  button {
    appearance: none;
    box-sizing: border-box;
    width: 100%;
    min-height: 34px;
    margin: 0;
    padding: 4px 12px;
    background: var(--mc-fill-caution);
    color: var(--mc-text-ink);
    border: 2.5px solid var(--mc-line-ink);
    font-family: var(--mc-font-display);
    font-style: italic;
    font-size: 17px;
    text-transform: uppercase;
    text-align: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: 2px;
  }
`;
