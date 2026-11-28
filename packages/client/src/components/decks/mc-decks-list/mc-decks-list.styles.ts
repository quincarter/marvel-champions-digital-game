import { css } from "lit";

export const McDecksListStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    min-height: 0;
  }
  .head,
  .status,
  .filters,
  .io {
    flex: none;
  }
  .new {
    flex: none;
    height: 28px;
    min-width: 96px;
  }
  .status {
    display: flex;
    gap: 6px;
    margin: 0;
    font-size: 13px;
    line-height: 1.3;
    font-weight: 700;
  }
  .status[data-tone="error"] {
    color: var(--mc-text-red);
  }
  .status[data-tone="success"] {
    color: var(--mc-text-heal);
  }
  .scroll {
    flex: 1;
    min-height: 100px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .row {
    display: block;
  }
  .empty {
    margin: 8px 4px;
    font-size: 14px;
    opacity: 0.75;
  }
  @media (pointer: coarse), (max-width: 1279px) {
    .new {
      height: 44px;
    }
  }
`;
