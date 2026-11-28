import { css } from "lit";

export const McLobbyButtonRowStyles = css`
  :host {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: var(--mc-lobby-row-gap, 8px);
  }
  :host([hidden]) {
    display: none;
  }
`;
