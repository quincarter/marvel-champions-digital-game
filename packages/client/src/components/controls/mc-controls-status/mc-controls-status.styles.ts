import { css } from "lit";

export const McControlsStatusStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    color: var(--mc-text-paper);
    font-size: var(--mc-small-12, 12px);
    font-weight: 700;
    letter-spacing: 0.04em;
    opacity: 0.85;
  }
  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--mc-line-paper);
    opacity: 0.6;
    box-sizing: border-box;
  }
  :host([connected]) .dot {
    background: var(--mc-fill-heal);
    border-color: var(--mc-fill-heal);
    opacity: 1;
  }
  .text {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;
