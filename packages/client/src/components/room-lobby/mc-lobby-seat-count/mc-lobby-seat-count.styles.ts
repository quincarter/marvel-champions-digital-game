import { css } from "lit";

export const McLobbySeatCountStyles = css`
  :host {
    display: block;
    color: var(--mc-text-ink);
  }
  mc-stepper {
    --arrow-width: 56px;
  }
  .hint {
    margin: 6px 0 0;
    font-family: var(--mc-font-body);
    font-size: 12px;
    opacity: 0.8;
  }
`;
