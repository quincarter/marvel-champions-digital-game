import { css } from "lit";

export const McRoomChatDialogStyles = css`
  :host {
    display: contents;
  }
  .lines {
    height: 100%;
  }
  .close {
    position: relative;
    display: block;
    height: var(--mc-target-height, 44px);
    --mc-button-size: 13px;
  }
`;
