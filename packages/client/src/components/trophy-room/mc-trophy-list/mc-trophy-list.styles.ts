import { css } from "lit";

export const McTrophyListStyles = css`
  :host {
    display: block;
    min-width: 0;
    min-height: 0;
  }
  .scroller {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-right: 14px;
  }
  .scroller > * {
    flex: none;
  }
`;
