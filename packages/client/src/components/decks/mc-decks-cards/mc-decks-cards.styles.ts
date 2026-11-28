import { css } from "lit";

export const McDecksCardsStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
  }
  .head,
  .below,
  .search {
    flex: none;
  }
  .head {
    flex-wrap: wrap;
  }
  .beside {
    flex: none;
    justify-content: flex-end;
  }
  .fold {
    flex: none;
    width: 124px;
    height: 44px;
  }
  .search {
    height: 28px;
  }
  .grid {
    flex: 1;
    height: auto;
    min-height: 120px;
  }
  .empty {
    flex: none;
  }
  @media (pointer: coarse), (max-width: 1279px) {
    .search {
      height: 44px;
    }
  }
`;
