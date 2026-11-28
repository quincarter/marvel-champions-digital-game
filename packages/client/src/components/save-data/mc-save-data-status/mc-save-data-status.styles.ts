import { css } from "lit";

export const McSaveDataStatusStyles = css`
  :host {
    display: block;
    color: var(--mc-text-paper);
  }
  .line {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    font-size: var(--mc-small-12, 12px);
    line-height: 1.45;
    opacity: 0.95;
  }
  .line[data-tone="error"] {
    color: var(--mc-text-caution, var(--mc-text-paper));
  }
  .mark {
    flex: none;
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 800;
  }
  mc-hint-button {
    display: block;
    width: min(100%, 200px);
    height: 44px;
    margin-top: 10px;
    --mc-button-size: 13px;
  }
`;
