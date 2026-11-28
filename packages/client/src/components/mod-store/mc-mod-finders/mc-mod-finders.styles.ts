import { css } from "lit";

export const McModFindersStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .controls {
    display: flex;
    gap: 8px;
  }
  mc-search-field {
    flex: 1;
    min-width: 0;
    height: 40px;
  }
  .sort {
    flex: none;
    width: 150px;
    height: 40px;
  }
  :host([size="phone"]) .sort {
    width: 112px;
  }
  .chips {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  mc-filter-bar {
    flex: 1;
    min-width: 0;
    --mc-chip-size: 11px;
  }
  .clear {
    flex: none;
    height: 40px;
    --mc-button-size: 11px;
  }
  .count {
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
`;
