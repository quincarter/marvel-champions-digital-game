import { css } from "lit";

export const McGuideActionsStyles = css`
  :host {
    display: flex;
    gap: 12px;
    align-items: stretch;
  }
  .suit {
    flex: 1;
    height: 52px;
  }
  /* Wide: Suit up takes 62% of the column and Back sits at its far end. */
  :host([show-back]) .suit {
    flex: 0 0 62%;
  }
  .ctl {
    position: relative;
    flex: none;
    margin-left: auto;
    width: 96px;
    height: 52px;
  }
  .back {
    --chip-height: 52px;
    --chip-size: 18px;
    --chip-fill: var(--mc-fill-parchment);
    width: 100%;
    height: 100%;
  }
`;
