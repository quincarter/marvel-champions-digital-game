import { css } from "lit";

export const McTocStyles = css`
  :host {
    display: block;
    min-height: 0;
  }
  mc-empty-state {
    padding: 4px 12px;
  }
  .scroller {
    height: 100%;
    padding: 0 4px;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 40px;
    margin-right: 6px;
    padding: 0 10px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .row::after {
    content: "";
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 0;
    height: 1px;
    background: color-mix(in srgb, var(--mc-fill-ink) 12%, transparent);
  }
  .row[data-selected] {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .title {
    min-width: 0;
    font-weight: 800;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
