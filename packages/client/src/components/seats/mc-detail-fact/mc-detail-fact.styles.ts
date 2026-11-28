import { css } from "lit";

export const McDetailFactStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .label {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .text {
    font-family: var(--mc-font-body);
    font-size: 14px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
`;
