import { css } from "lit";

/** One row of controls (44px each) that wraps: the chips take a full row of their own, or the rest of the toggle's row. */
export const McScenarioFiltersStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .toggle {
    order: 1;
    flex: none;
  }
  .search {
    order: 4;
    flex: 1 0 100%;
    height: 44px;
    min-width: 0;
  }
  .filters {
    order: 2;
    flex: 1 1 0;
    height: 44px;
    min-width: 0;
  }
  .chips {
    order: 3;
    flex: 1 0 100%;
    min-width: 0;
  }
  /* No Filters button: the chips ride the toggle's row as a rail. */
  .chips.inline {
    order: 2;
    flex: 1 1 0;
  }
  /* A wide screen: the field leads its row, with the hint and the Filters button at its end; the chips wrap under. */
  :host([wide]) .search {
    order: 1;
    flex: 1 1 0;
  }
  :host([wide]) .hint {
    order: 2;
    flex: none;
  }
  :host([wide]) .filters {
    order: 3;
    flex: 0 0 156px;
  }
  :host([wide]) .chips,
  :host([wide]) .chips.inline {
    order: 4;
    flex: 1 0 100%;
  }
`;
