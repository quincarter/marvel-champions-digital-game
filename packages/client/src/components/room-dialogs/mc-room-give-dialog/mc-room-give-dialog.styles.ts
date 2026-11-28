import { css } from "lit";

export const McRoomGiveDialogStyles = css`
  :host {
    display: contents;
  }
  .empty {
    margin: 0;
    font-size: 15px;
    line-height: 1.35;
    opacity: 0.85;
  }
  .people {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  mc-popup-button {
    position: relative;
    display: block;
    height: var(--mc-target-height, 44px);
    flex: none;
    --mc-button-size: 13px;
  }
`;
