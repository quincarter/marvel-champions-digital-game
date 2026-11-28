import { css } from "lit";

export const McTipPlateStyles = css`
  :host {
    position: absolute;
    z-index: 5;
    display: block;
    padding: 10px;
    background: var(--mc-fill-card);
    box-shadow: inset 0 0 0 2px var(--mc-line-ink);
    font-size: 14px;
    line-height: 1.3;
    cursor: pointer;
  }
  :host([hidden]) {
    display: none;
  }
  :host(:not([placed])) {
    visibility: hidden;
  }
`;
