import { css } from "lit";

export const McModMessageStyles = css`
  :host {
    display: block;
  }
  .text {
    display: block;
    font-size: 14px;
    line-height: 1.25;
    opacity: 0.6;
  }
  .retry {
    display: block;
    width: 160px;
    height: 44px;
    margin-top: 12px;
  }
  :host([kind="offline"]) {
    display: flex;
    align-items: center;
    min-height: 34px;
    padding: 6px 12px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  :host([kind="offline"]) .text {
    font-weight: 800;
    font-size: 12px;
    opacity: 1;
  }
`;
