import { css } from "lit";

export const McBriefingWatchToggleStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 0 10px;
    min-width: 0;
  }
  .box {
    flex: none;
    width: 22px;
    height: 22px;
    border: 2px solid currentColor;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 15px;
    line-height: 1;
  }
  .words {
    min-width: 0;
    font-weight: 800;
    font-size: var(--mc-small-10);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :host([onink]) {
    color: var(--mc-text-paper);
  }
`;
