import { css } from "lit";

export const McTrophySheetStyles = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    overflow: hidden;
  }
  /* The scrim takes every press that lands outside the box: a tap closes the sheet, nothing beneath is pressed. */
  .scrim {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--mc-fill-ink) 60%, transparent);
  }
  .box {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(520px, 100%);
    max-height: 100%;
    overflow-y: auto;
    padding: 20px;
    background: var(--mc-fill-paper);
    border: 3px solid var(--mc-line-ink);
    color: var(--mc-text-ink);
  }
  .name {
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 28px;
    line-height: 1.1;
    letter-spacing: 1px;
  }
  .facts {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 1.4;
    white-space: pre-wrap;
  }
  .detail {
    margin: 4px 0 10px;
    font-size: 15px;
    line-height: 1.45;
  }
  .close {
    align-self: center;
    width: 160px;
    height: 48px;
    --mc-button-size: 16px;
  }
  @media (max-width: 599px) {
    .name {
      font-size: 24px;
    }
  }
`;
