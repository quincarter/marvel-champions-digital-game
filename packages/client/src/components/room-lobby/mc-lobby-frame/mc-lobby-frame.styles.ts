import { css } from "lit";

export const McLobbyFrameStyles = css`
  :host {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    box-sizing: border-box;
    padding: 8px 10px;
    background: var(--mc-fill-parchment);
    color: var(--mc-text-ink);
    border: 2px solid var(--mc-line-ink);
  }
  :host([floating]) {
    border-width: 3px;
    box-shadow: 6px 6px 0 var(--mc-fill-ink);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 30px;
    margin: 0 2px 6px;
  }
  h2 {
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 18px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  slot:not([name]) {
    display: contents;
  }
`;
