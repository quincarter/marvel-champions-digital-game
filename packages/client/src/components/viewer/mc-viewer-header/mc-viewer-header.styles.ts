import { css } from "lit";

export const McViewerHeaderStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 24px;
    height: 60px;
    padding: 0 24px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    border-bottom: 2px solid var(--mc-fill-red);
  }
  :host([compact]) {
    padding: 0 12px;
    gap: 12px;
  }
  .title {
    flex: 1 1 0;
    min-width: 0;
    font-family: var(--mc-font-display);
    font-size: 32px;
    letter-spacing: 1px;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host([compact]) .title {
    font-size: 24px;
  }
  .close {
    flex: none;
    width: 40px;
    height: 40px;
    --mc-button-size: 16px;
  }
`;
