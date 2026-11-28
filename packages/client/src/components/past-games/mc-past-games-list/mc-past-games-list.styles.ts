import { css } from "lit";

export const McPastGamesListStyles = css`
  :host {
    display: block;
    min-width: 0;
    min-height: 0;
  }
  .scroller {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    padding: 4px 10px 4px 4px;
  }
  .scroller > mc-past-game-row {
    flex: none;
  }
  mc-empty-state {
    display: block;
    width: min(560px, 100%);
    margin: 24px auto 0;
  }
`;
