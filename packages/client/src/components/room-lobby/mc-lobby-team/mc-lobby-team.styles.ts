import { css } from "lit";

export const McLobbyTeamStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: var(--mc-fill-parchment);
    color: var(--mc-text-ink);
    border: 2px solid var(--mc-line-ink);
  }
  /* Your own side: a heavier border, never colour alone. */
  :host([mine]) {
    border-width: 4px;
  }
  :host([hidden]) {
    display: none;
  }
  .title {
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 17px;
    letter-spacing: 1px;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  .status {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
  }
  .seats {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .seat {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
`;
