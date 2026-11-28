import { css } from "lit";

export const McBriefingPoolRowStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 54px;
    padding: 8px 12px 8px 14px;
    --thumb-width: 44px;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .name {
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .where {
    font-size: var(--mc-small-11);
    line-height: 1.45;
    opacity: 0.7;
    overflow-wrap: anywhere;
  }
  .mark {
    flex: none;
    width: 24px;
    text-align: center;
    font-weight: 800;
    font-size: 16px;
  }
`;
