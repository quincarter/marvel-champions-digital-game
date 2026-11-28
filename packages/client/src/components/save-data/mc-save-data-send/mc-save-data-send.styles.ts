import { css } from "lit";

export const McSaveDataSendStyles = css`
  :host {
    display: block;
    color: var(--mc-text-paper);
  }
  .layout {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 18px 24px;
  }
  .text {
    flex: 1 1 280px;
    min-width: 0;
  }
  mc-qr-code {
    flex: 0 1 220px;
    --qr-size: 220px;
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
  .code {
    margin: 0 0 14px;
    font-family: var(--mc-font-mono);
    font-size: clamp(16px, 5vw, 30px);
    letter-spacing: 0.04em;
    overflow-wrap: anywhere;
  }
  .countdown {
    margin: 0 0 12px;
    font-size: var(--mc-small-14, 14px);
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
