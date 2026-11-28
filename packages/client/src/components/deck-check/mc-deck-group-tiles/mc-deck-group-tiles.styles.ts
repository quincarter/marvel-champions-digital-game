import { css } from "lit";

export const McDeckGroupTilesStyles = css`
  :host {
    display: block;
  }
  .heading {
    margin-bottom: 7px;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
  }
  .empty {
    font-size: var(--mc-small-11, 11px);
    opacity: 0.75;
  }
`;
