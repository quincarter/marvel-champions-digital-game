import { css } from "lit";
import { PopupPartStyles } from "../../shared/popup-parts.js";

export const McPlayerControlsStyles = css`
  ${PopupPartStyles}
  :host {
    display: block;
  }
  .row {
    display: flex;
    gap: 8px;
    height: 40px;
  }
  .row + .row {
    margin-top: 8px;
  }
  .row .ctl {
    flex: 1;
  }
  :host([slider]) .pause .ctl {
    flex: 0 0 104px;
  }
  slot {
    display: none;
  }
  :host([slider]) slot {
    display: block;
    flex: 1;
    min-width: 0;
  }
`;
