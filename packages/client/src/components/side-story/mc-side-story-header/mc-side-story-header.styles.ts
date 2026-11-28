import { css } from "lit";

export const McSideStoryHeaderStyles = css`
  :host {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 24px 10px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  :host([compact]) {
    padding: 14px 16px 10px;
  }
  .words {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .label {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .title {
    font-family: var(--mc-font-display);
    font-size: 30px;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host([compact]) .title {
    font-size: 22px;
  }
  .credit {
    font-size: 12px;
    opacity: 0.6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host([compact]) .credit {
    font-size: 10px;
  }
  .close {
    flex: none;
    width: 96px;
    height: 30px;
    --mc-button-size: 11px;
  }
  :host([compact]) .close {
    width: 78px;
  }
`;
