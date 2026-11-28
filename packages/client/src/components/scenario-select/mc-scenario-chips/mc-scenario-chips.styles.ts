import { css } from "lit";

export const McScenarioChipsStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 8px;
  }
  :host([rail]) .chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  :host([rail]) .chips::-webkit-scrollbar {
    display: none;
  }
  mc-filter-chip {
    display: block;
    flex: 0 0 auto;
    max-width: 100%;
    height: 44px;
  }
`;
