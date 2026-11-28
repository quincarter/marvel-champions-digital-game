import { css } from "lit";

export const McBriefingKickerStyles = css`
  :host {
    display: block;
    min-width: 0;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    line-height: 1.2;
    color: var(--mc-text-red);
  }
  :host([tone="cost"]) {
    color: var(--mc-text-cost);
  }
  :host([tone="heal"]) {
    color: var(--mc-text-heal);
  }
  :host([tone="ink"]) {
    color: var(--mc-text-ink);
    opacity: 0.6;
  }
`;
