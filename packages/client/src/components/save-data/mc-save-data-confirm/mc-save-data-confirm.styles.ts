import { css } from "lit";

export const McSaveDataConfirmStyles = css`
  :host {
    display: block;
    color: var(--mc-text-paper);
  }
  .title {
    margin: 0 0 10px;
    font-family: var(--mc-font-display);
    font-size: 22px;
    font-weight: 400;
    letter-spacing: 0.04em;
  }
  .body {
    margin: 0 0 16px;
    font-size: var(--mc-small-14, 14px);
    line-height: 1.5;
    opacity: 0.9;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  mc-hint-button {
    width: 180px;
    max-width: 100%;
    height: 44px;
    --mc-button-size: 13px;
  }
`;
