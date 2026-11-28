import { css } from "lit";

export const McSaveDataReceiveStyles = css`
  :host {
    display: block;
    color: var(--mc-text-paper);
  }
  .title {
    margin: 0 0 8px;
    font-family: var(--mc-font-display);
    font-size: 22px;
    font-weight: 400;
    letter-spacing: 0.04em;
  }
  .help {
    margin: 0 0 14px;
    font-size: var(--mc-small-12, 12px);
    line-height: 1.5;
    opacity: 0.85;
  }
  mc-text-field {
    display: block;
    width: min(100%, 320px);
    margin-bottom: 14px;
    font-family: var(--mc-font-mono);
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  mc-hint-button {
    width: 150px;
    max-width: 100%;
    height: 44px;
    --mc-button-size: 13px;
  }
`;
