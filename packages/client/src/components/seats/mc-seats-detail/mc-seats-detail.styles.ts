import { css } from "lit";

export const McSeatsDetailStyles = css`
  :host {
    display: block;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
  }
  .note {
    margin: 0;
    font-family: var(--mc-font-body);
    font-weight: 700;
    font-size: var(--mc-small-9);
    letter-spacing: 1px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .empty {
    margin: 0;
    font-family: var(--mc-font-body);
    font-size: 14px;
    line-height: 1.4;
    opacity: 0.75;
  }
`;
