import { css } from "lit";

export const McTrophyRankStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    padding: 10px 18px 12px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  :host([phone]) {
    padding: 10px 12px 12px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.1px;
    line-height: 1.2;
  }
  .rank {
    opacity: 0.8;
    white-space: nowrap;
  }
  .points {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title {
    margin: 4px 0 6px;
    font-family: var(--mc-font-display);
    font-size: 34px;
    letter-spacing: 1px;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host([phone]) .title {
    font-size: 26px;
  }
  .caption {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    font-size: 12px;
    opacity: 0.9;
  }
  .next {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .earned {
    flex: none;
    white-space: nowrap;
  }
  mc-progress-bar {
    --mc-progress-height: 12px;
    color: var(--mc-text-paper);
  }
`;
