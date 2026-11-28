import { css } from "lit";

export const McWinTitleStyles = css`
  :host {
    display: block;
    font-family: var(--mc-font-display);
    color: var(--mc-text-ink);
  }
  .line {
    margin: 0;
    font-weight: 400;
    font-size: var(--title-size, 30px);
    line-height: 1;
    text-transform: uppercase;
  }
  .lose {
    color: var(--mc-text-red);
  }
`;
