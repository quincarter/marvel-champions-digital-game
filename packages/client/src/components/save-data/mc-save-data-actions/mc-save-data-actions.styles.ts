import { css } from "lit";

export const McSaveDataActionsStyles = css`
  :host {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 18px 16px;
    color: var(--mc-text-paper);
  }
  .row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    font-family: var(--mc-font-display);
    font-size: 20px;
    font-weight: 400;
    letter-spacing: 0.04em;
  }
  .detail {
    margin: 0 0 6px;
    font-size: var(--mc-small-12, 12px);
    line-height: 1.4;
    opacity: 0.8;
  }
  .button {
    width: min(100%, 200px);
    height: 44px;
    --mc-button-size: 13px;
  }
`;
