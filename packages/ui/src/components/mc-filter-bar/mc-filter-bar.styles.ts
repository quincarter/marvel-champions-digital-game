import { css } from "lit";

/**
 * Chips side by side, wrapping to the next row; rows past a limit are cut off rather than spilling over the list. The
 * sort selector sits at the end of the last row, pushed to the right.
 */
export const McFilterBarStyles = css`
  :host {
    display: block;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    align-items: stretch;
    overflow: hidden;
  }
  .chip {
    display: block;
    flex: 0 0 auto;
    max-width: 100%;
  }
  .sheet {
    display: block;
    flex: 0 0 auto;
    padding: 0 6px;
  }
  .sort {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    font: 800 var(--mc-small-10, 10px) var(--mc-font-body);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--mc-text-ink);
  }
  select {
    min-height: 44px;
    padding: 0 12px;
    font: 800 var(--mc-chip-size, 11px) var(--mc-font-body);
    color: var(--mc-text-ink);
    background: var(--mc-fill-paper);
    border: 2px solid var(--mc-line-ink);
    border-radius: 0;
  }
`;
