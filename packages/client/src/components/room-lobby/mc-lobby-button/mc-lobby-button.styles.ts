import { css } from "lit";

export const McLobbyButtonStyles = css`
  :host {
    display: block;
    height: var(--mc-lobby-button-height, 44px);
  }
  mc-button {
    height: 100%;
    --mc-button-size: var(--mc-lobby-button-size, 12px);
  }
  :host([display]) mc-button {
    --mc-button-size: var(--mc-lobby-button-size, 22px);
  }
`;
