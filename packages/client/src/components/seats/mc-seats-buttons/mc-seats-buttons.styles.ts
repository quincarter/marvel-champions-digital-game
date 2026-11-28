import { css } from "lit";

export const McSeatsButtonsStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }
  mc-button {
    flex: 0 1 auto;
    min-width: 96px;
    height: 44px;
    --mc-button-size: 11px;
  }
`;
