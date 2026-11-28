import { css } from "lit";
import { PopupPartStyles } from "../../shared/popup-parts.js";

export const McLanguageOptionStyles = css`
  ${PopupPartStyles}
  :host {
    display: block;
    height: var(--row-h, 44px);
  }
  mc-button {
    --mc-button-size: 13px;
  }
`;
