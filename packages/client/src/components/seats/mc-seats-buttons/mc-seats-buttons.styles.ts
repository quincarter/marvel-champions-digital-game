import { css } from "lit";

export const McSeatsButtonsStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }
  mc-button {
    flex: 0 1 auto;
    min-width: 96px;
    height: 44px;
    --mc-button-size: 11px;
  }
  /* A phone's row: the three buttons share the width, their words wrap inside them. */
  @media (max-width: 767px) {
    :host {
      flex: 1 1 100%;
      flex-wrap: nowrap;
      gap: 6px;
    }
    mc-button {
      flex: 1 1 0;
      min-width: 0;
      --mc-button-size: 10px;
    }
  }
`;
