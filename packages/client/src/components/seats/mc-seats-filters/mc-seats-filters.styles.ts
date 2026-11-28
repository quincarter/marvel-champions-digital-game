import { css } from "lit";

/** The row wraps: a wide screen has the field, the buttons and the chips; a narrow one the toggles, the buttons, then the field and the chip rail. */
export const McSeatsFiltersStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .search {
    flex: 1 1 220px;
    min-width: 0;
    height: 44px;
  }
  .filters {
    flex: 0 0 auto;
    min-width: 120px;
    height: 44px;
    --mc-button-size: 12px;
  }
  .loupe {
    all: unset;
    box-sizing: border-box;
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    color: var(--mc-text-ink);
    background: var(--mc-fill-paper);
    outline: 2.5px solid var(--mc-line-ink);
    outline-offset: -1.25px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .loupe[aria-pressed="true"] {
    color: var(--mc-text-paper);
    background: var(--mc-fill-ink);
  }
  mc-seats-buttons {
    flex: 0 1 auto;
  }
  @media (max-width: 767px) {
    .filters {
      flex: 1 1 0;
      min-width: 0;
    }
    mc-seats-buttons {
      flex: 1 1 100%;
    }
  }
`;
