import { css } from "lit";

export const McBriefingFramedRowStyles = css`
  :host {
    display: block;
    position: relative;
    min-width: 0;
    background: var(--mc-fill-card);
    border: 2px solid var(--mc-line-ink);
  }
  :host([fill="parchment"]) {
    background: var(--mc-fill-parchment);
  }
  :host([fill="none"]) {
    background: transparent;
  }
  .stripe {
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 6px;
  }
  :host([stripe="heal"]) .stripe {
    display: block;
    background: var(--mc-fill-heal);
  }
  :host([stripe="red"]) .stripe {
    display: block;
    background: var(--mc-fill-red);
  }
`;
