import { css } from "lit";

export const McSeatsChipsStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 6px;
  }
  /* A rail: one row that scrolls sideways under a finger or a wheel, its scrollbar out of sight. */
  :host([rail]) .bar {
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  :host([rail]) .bar::-webkit-scrollbar {
    display: none;
  }
`;
