import { css } from "lit";

export const McCivilRailStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--mc-text-ink);
  }
  :host([mode="phone"]) {
    flex-direction: row;
    gap: 4px;
  }
  mc-press-card {
    display: block;
  }
  .cell {
    flex: 1;
    text-align: center;
  }
  .mark {
    font-family: var(--mc-font-display);
    font-size: 20px;
    line-height: 36px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .name {
    font-weight: 800;
    font-size: var(--mc-small-13, 13px);
  }
  .line {
    margin-top: 2px;
    font-size: var(--mc-small-11, 11px);
    line-height: 1.3;
    opacity: 0.75;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .bang {
    margin-left: 2px;
    font-weight: 800;
  }
`;
