import { css } from "lit";

export const McBriefingRoleBuildListStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 0 4px;
  }
  .group-label {
    margin: 6px 0 0;
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    opacity: 0.7;
  }
  .rec {
    display: flex;
    gap: 12px;
    padding: 8px 8px 8px 0;
    --thumb-width: 104px;
  }
  .rec-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tag {
    align-self: flex-start;
    padding: 0 6px;
    background: var(--mc-fill-red);
    color: var(--mc-text-paper);
    font-weight: 800;
    font-size: var(--mc-small-10);
    letter-spacing: 1.2px;
    line-height: 18px;
  }
  .rec-name {
    margin-top: 2px;
    font-weight: 800;
    font-size: 14px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .reason {
    font-size: var(--mc-small-11);
    line-height: 1.45;
    opacity: 0.75;
  }
  .rec-buttons {
    display: flex;
    gap: 6px;
    margin-top: auto;
  }
  .rec-buttons mc-button {
    flex: 1;
    height: 40px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: 8px;
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 2px 0;
    --thumb-width: 100%;
  }
  .cell-art {
    width: 100%;
  }
  .read-block {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 2px;
  }
  .read {
    inset: 0;
  }
  .cell-name {
    font-weight: 800;
    font-size: var(--mc-small-11);
    line-height: 1.25;
    min-height: 3.7em;
    overflow-wrap: anywhere;
  }
  .cell-cost {
    font-size: var(--mc-small-10);
    opacity: 0.75;
  }
  .cell mc-button {
    height: 36px;
  }
`;
