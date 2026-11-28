import { css } from "lit";

export const McDeckCardRowStyles = css`
  :host {
    display: flex;
    align-items: center;
    height: 26px;
    background: var(--mc-fill-card);
    box-shadow: inset 0 0 0 2px var(--mc-line-ink);
  }
  .pip {
    flex: none;
    width: 26px;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--pip, var(--mc-fill-ink));
    color: var(--mc-text-paper);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
  }
  .name {
    flex: 1;
    min-width: 0;
    padding: 0 8px;
    font-size: var(--mc-small-11, 11px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .quantity {
    flex: none;
    padding-right: 10px;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    opacity: 0.75;
  }
`;
