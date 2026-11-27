import { css } from "lit";

/** The rail: a parchment ground with a 2px ink frame and equal cells. */
export const McTabRailStyles = css`
  :host {
    display: flex;
    background: var(--mc-fill-parchment);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -1px;
  }
  .cell {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
  }
  mc-button {
    width: 100%;
    height: 100%;
  }
  .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--mc-fill-red);
    color: var(--mc-text-paper);
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    pointer-events: none;
  }
`;
