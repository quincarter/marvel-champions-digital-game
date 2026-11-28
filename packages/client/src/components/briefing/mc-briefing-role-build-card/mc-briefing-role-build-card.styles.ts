import { css } from "lit";

export const McBriefingRoleBuildCardStyles = css`
  :host {
    display: block;
    padding: 14px;
    border: 2px solid var(--mc-line-ink);
    min-width: 0;
  }
  .title {
    margin: 0 0 10px;
    font-size: 28px;
    line-height: 1;
    overflow-wrap: anywhere;
  }
  .title.phone {
    font-size: 24px;
  }
  .body-row {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    --thumb-width: 150px;
  }
  .body-row.phone {
    --thumb-width: 120px;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .name {
    font-weight: 700;
    font-size: 13px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .name.cost {
    margin-top: -6px;
  }
  .note {
    font-size: var(--mc-small-11);
    line-height: 1.45;
    opacity: 0.75;
  }
`;
