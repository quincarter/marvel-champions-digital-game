import { css } from "lit";

export const McBriefingDeckRowStyles = css`
  :host {
    min-width: 0;
    container-type: inline-size;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    column-gap: 12px;
    row-gap: 4px;
    padding: 12px;
    min-height: 44px;
  }
  .row.problem {
    background: color-mix(in srgb, var(--mc-fill-red) 10%, transparent);
  }
  .title {
    font-size: 16px;
    letter-spacing: 1px;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    font-weight: 800;
    font-size: 14px;
    white-space: nowrap;
  }
  .go {
    font-weight: 800;
    font-size: 18px;
  }
  .why {
    grid-column: 1 / -1;
    font-weight: 800;
    font-size: 14px;
    line-height: 1.25;
    color: var(--mc-text-red);
    overflow-wrap: anywhere;
  }
  @container (max-width: 300px) {
    .count {
      grid-column: 1;
      grid-row: 2;
    }
    .title {
      grid-column: 1;
    }
    .go {
      grid-column: 3;
      grid-row: 1;
    }
  }
`;
