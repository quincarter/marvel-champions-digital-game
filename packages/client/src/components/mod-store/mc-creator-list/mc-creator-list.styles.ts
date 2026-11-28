import { css } from "lit";

export const McCreatorListStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 60px;
  }
  .intro,
  .empty {
    margin: 0;
    font-size: 14px;
    line-height: 1.2;
    opacity: 0.6;
  }
  .intro {
    /* Two lines at most: the list under it is what the screen is for. */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    flex: none;
  }
  :host([size="phone"]) .intro {
    font-size: 12px;
  }
  .list {
    flex: 1;
    min-height: 60px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 12px;
  }
  mc-creator-row {
    flex: none;
  }
`;
