import { css } from "lit";

export const McRoomAskDialogStyles = css`
  :host {
    display: contents;
  }
  .body {
    margin: 0 0 12px;
    font-size: 15px;
    line-height: 1.35;
    opacity: 0.9;
  }
  .field {
    display: block;
    height: var(--mc-primary-height, 52px);
  }
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  mc-popup-button {
    position: relative;
    display: block;
    height: var(--mc-primary-height, 52px);
    --mc-button-size: 13px;
  }
`;
