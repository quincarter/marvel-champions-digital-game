import { css } from "lit";

/** Chips wrap in rows of the bar height with a 6px gap; the Filters button and the sort chip share the row. */
export const McFilterBarStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-content: flex-start;
    justify-content: var(--bar-justify, flex-start);
  }
  .cell {
    height: var(--bar-row, 28px);
    display: inline-flex;
  }
  mc-filter-chip {
    height: 100%;
  }
  .badge {
    margin-left: 2px;
  }
`;
