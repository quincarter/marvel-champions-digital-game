import { css } from "lit";

export const McEmptyStateStyles = css`
  :host {
    display: block;
    color: var(--mc-text-ink);
  }
  :host([align="center"]) {
    text-align: center;
  }
  .message {
    font-size: var(--mc-empty-size, 14px);
    line-height: 1.45;
    opacity: 0.75;
  }
  .detail {
    margin-top: 6px;
    font-size: var(--mc-small-10, 10px);
    line-height: 1.45;
    opacity: 0.6;
  }
`;
