import { css } from "lit";

export const McDeckTypeFilterStyles = css`
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
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  mc-button {
    flex: 1 1 auto;
    height: 26px;
    min-width: 44px;
    --mc-button-size: var(--mc-small-9, 9px);
  }
`;
