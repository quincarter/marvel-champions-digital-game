import { css } from "lit";

export const McDeckStatusBadgeStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 12px;
    background: var(--mc-fill-heal);
    color: var(--mc-text-paper);
    font-family: var(--mc-font-display);
    font-size: 18px;
    white-space: nowrap;
  }
  :host([tone="illegal"]) {
    background: var(--mc-fill-red);
  }
  :host([tone="unscripted"]),
  :host([tone="poolChanged"]) {
    background: var(--mc-fill-caution);
  }
`;
