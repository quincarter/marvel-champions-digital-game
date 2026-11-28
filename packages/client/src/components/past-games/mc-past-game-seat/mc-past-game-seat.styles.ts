import { css } from "lit";

export const McPastGameSeatStyles = css`
  :host {
    display: block;
    margin-bottom: 8px;
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
  }
  .heading {
    font-size: 14px;
    font-weight: 800;
    line-height: 1.25;
  }
  .line {
    margin-top: 1px;
    font-size: 13px;
    line-height: 1.3;
    opacity: 0.75;
  }
`;
