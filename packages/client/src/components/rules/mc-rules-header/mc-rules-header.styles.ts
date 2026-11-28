import { css } from "lit";

export const McRulesHeaderStyles = css`
  :host {
    display: block;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .title-row {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 56px;
    padding: 0 16px;
  }
  .back {
    flex: none;
    height: 36px;
    --mc-button-size: 16px;
  }
  .title {
    min-width: 0;
    font-family: var(--mc-font-display);
    font-size: 24px;
    letter-spacing: 1px;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transform: translateY(var(--drop, 0px));
  }
`;
