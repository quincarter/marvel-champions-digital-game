import { css } from "lit";

export const McBriefingPickCardStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 4px 8px;
    min-width: 0;
    --thumb-height: var(--pick-height, 76px);
  }
  .words {
    flex: 1 1 78px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .quiet {
    opacity: 0.6;
  }
  .name {
    font-weight: 800;
    font-size: var(--mc-small-11);
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
`;
