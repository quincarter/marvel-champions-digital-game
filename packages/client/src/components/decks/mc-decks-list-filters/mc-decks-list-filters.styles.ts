import { css } from "lit";

export const McDecksListFiltersStyles = css`
  .bar {
    display: flex;
    gap: 6px;
    align-items: stretch;
  }
  .search {
    flex: 1;
    min-width: 0;
    height: 28px;
  }
  .filters {
    flex: none;
    width: 78px;
    height: 28px;
  }
  .chips {
    margin-top: 8px;
  }
  @media (pointer: coarse), (max-width: 1279px) {
    .search,
    .filters {
      height: 44px;
    }
  }
`;
