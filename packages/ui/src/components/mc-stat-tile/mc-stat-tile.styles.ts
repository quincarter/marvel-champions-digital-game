import { css } from "lit";

export const McStatTileStyles = css`
  :host {
    flex: 1;
    min-width: 0;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--mc-fill-card);
    box-shadow: inset 0 0 0 3px var(--mc-line-ink);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    white-space: nowrap;
    overflow: hidden;
  }
`;
