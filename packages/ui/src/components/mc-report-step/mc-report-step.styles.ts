import { css } from "lit";
import { PopupPartStyles } from "../../shared/popup-parts.js";

export const McReportStepStyles = css`
  ${PopupPartStyles}
  :host {
    display: block;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
  :host([phone]) h3 {
    font-size: 11px;
  }
  p {
    margin: 0 0 10px;
    font-size: 15px;
    line-height: 1.25;
    opacity: 0.9;
  }
  :host([phone]) p {
    font-size: 14px;
  }
  .row {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
  }
  .row:last-child {
    margin-bottom: 0;
  }
  .row .ctl {
    flex: 1;
    height: 44px;
  }
`;
