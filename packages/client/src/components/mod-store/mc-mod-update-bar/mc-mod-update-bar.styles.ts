import { css } from "lit";

export const McModUpdateBarStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: var(--mc-fill-card);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
  }
  .words {
    flex: 1 1 200px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    min-height: 44px;
  }
  .text {
    font-weight: 800;
    font-size: 13px;
    line-height: 1.2;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
  }
  .text.running {
    font-size: 11px;
    -webkit-line-clamp: 1;
  }
  .track {
    height: 10px;
    padding: 2px;
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
  }
  .fill {
    height: 100%;
    background: var(--mc-fill-heal);
  }
  .buttons {
    flex: none;
    display: flex;
    gap: 10px;
  }
  mc-button {
    width: 200px;
    height: 44px;
  }
  mc-button.show {
    width: 150px;
  }
  /* A phone: the buttons take their own row under the words, sharing it. */
  :host([size="phone"]) .buttons {
    flex: 1 1 100%;
  }
  :host([size="phone"]) mc-button,
  :host([size="phone"]) mc-button.show {
    flex: 1;
    width: auto;
    min-width: 0;
  }
  :host([size="phone"]) .buttons:has(mc-button:only-child) {
    flex: none;
    width: 128px;
  }
`;
