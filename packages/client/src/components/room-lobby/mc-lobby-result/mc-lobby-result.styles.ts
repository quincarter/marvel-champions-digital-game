import { css } from "lit";

export const McLobbyResultStyles = css`
  :host {
    display: block;
  }
  .box {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    background: var(--mc-fill-paper);
    color: var(--mc-text-ink);
    border: 3px solid var(--mc-line-ink);
  }
  .head {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .mark {
    flex: none;
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    font-family: var(--mc-font-display);
    font-size: 16px;
    line-height: 1;
  }
  .headline {
    margin: 0;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .line {
    margin: 0;
    font-family: var(--mc-font-body);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
`;
