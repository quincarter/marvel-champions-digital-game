import { css } from "lit";

export const McWinCardsStyles = css`
  :host {
    display: grid;
    gap: 14px;
    min-height: 0;
  }
  /* Wide: the tall WIN card at the left, the two LOSE cards stacked at the right. */
  :host([mode="wide"]) {
    grid-template-columns: 46fr 54fr;
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  }
  :host([mode="wide"]) .win {
    grid-row: 1 / span 2;
  }
  .win,
  .hero {
    --art-height: 100px;
  }
  .scheme {
    --art-height: 84px;
  }
  mc-win-card {
    min-height: 0;
  }
`;
