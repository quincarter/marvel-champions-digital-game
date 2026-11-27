import { css } from "lit";

export const McEmptyStateStyles = css`
  :host {
    display: block;
    font-size: var(--mc-empty-size, 14px);
    line-height: 1.45;
    color: var(--mc-text-ink);
    opacity: 0.75;
  }
`;
