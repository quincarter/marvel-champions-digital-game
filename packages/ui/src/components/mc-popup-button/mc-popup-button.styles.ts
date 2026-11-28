import { css } from "lit";

export const McPopupButtonStyles = css`
  :host {
    display: block;
    position: relative;
    min-width: 0;
    height: 100%;
  }
  mc-button {
    height: 100%;
    --mc-button-size: 12px;
  }
  .hang {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 3;
    pointer-events: none;
  }
  .hang.left {
    left: auto;
    right: calc(100% + 6px);
  }
`;
