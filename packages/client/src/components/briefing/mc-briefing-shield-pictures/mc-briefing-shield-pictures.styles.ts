import { css } from "lit";

export const McBriefingShieldPicturesStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
    --thumb-width: 104px;
  }
  :host([phone]) {
    --thumb-width: 78px;
  }
  .cell {
    width: var(--thumb-width);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .caption {
    font-weight: 800;
    font-size: var(--mc-small-10);
    letter-spacing: 1.2px;
    line-height: 1.2;
    opacity: 0.75;
    overflow-wrap: anywhere;
  }
`;
