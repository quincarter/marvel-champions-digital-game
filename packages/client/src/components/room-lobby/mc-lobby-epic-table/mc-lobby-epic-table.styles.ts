import { css } from "lit";

export const McLobbyEpicTableStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: var(--mc-fill-parchment);
    color: var(--mc-text-ink);
    border: 2px solid var(--mc-line-ink);
  }
  /* Your own table: a heavier border, never colour alone. */
  :host([mine]) {
    border-width: 4px;
  }
  :host([hidden]) {
    display: none;
  }
  .name {
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 17px;
    letter-spacing: 1px;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  .facts {
    margin: 0;
    font-size: 13px;
    opacity: 0.9;
  }
  .host {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .seats {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
`;
