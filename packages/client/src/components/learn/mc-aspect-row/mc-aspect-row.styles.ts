import { css } from "lit";

export const McAspectRowStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  mc-link-row {
    --row-height: 76px;
  }
  .tagline {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.35;
    opacity: 0.75;
  }
  .done {
    font-size: 13px;
    opacity: 0.75;
    white-space: nowrap;
  }
`;
