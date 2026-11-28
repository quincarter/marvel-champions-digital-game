import { css } from "lit";

export const McUnlocksPointsStyles = css`
  :host {
    display: block;
    color: var(--mc-text-paper);
  }
  .heading {
    margin: 0;
    font-family: var(--mc-font-display);
    font-size: 20px;
    font-weight: 400;
    letter-spacing: 0.04em;
  }
  .detail {
    margin: 4px 0 0;
    font-size: var(--mc-small-12, 12px);
    line-height: 1.4;
    opacity: 0.8;
  }
`;
