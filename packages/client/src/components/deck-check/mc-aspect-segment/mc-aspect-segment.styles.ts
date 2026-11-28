import { css } from "lit";

export const McAspectSegmentStyles = css`
  :host {
    display: flex;
    height: 44px;
  }
  .tile {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    padding: 0 11px;
    box-shadow: inset 0 0 0 2px var(--mc-line-ink);
    opacity: 0.7;
    font-family: var(--mc-font-display);
    font-size: 16px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host([chosen]) .tile {
    background: var(--mc-fill-heal);
    color: var(--mc-text-paper);
    opacity: 1;
  }
  .info {
    flex: none;
    width: 44px;
  }
`;
