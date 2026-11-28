import { css } from "lit";

export const McBriefingOptionsStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
  }
  .pair {
    display: flex;
    gap: 12px;
  }
  .grid {
    align-self: stretch;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }
  .grid.cards {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
  .cell {
    display: flex;
    align-items: stretch;
    gap: 12px;
    --thumb-height: 76px;
  }
  .cell mc-button {
    flex: 1;
    min-width: 0;
    min-height: 76px;
  }
  mc-button {
    min-height: 44px;
  }
  mc-button.decline,
  mc-button.accept,
  mc-hint-button.confirm {
    width: 160px;
    height: 44px;
  }
`;
