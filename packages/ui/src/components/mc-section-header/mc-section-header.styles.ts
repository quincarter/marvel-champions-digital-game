import { css } from "lit";

/** A heading in the display face, tracked, in capitals, with a 2px ink rule filling the rest of the line. */
export const McSectionHeaderStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: none;
  }
  .label {
    font-family: var(--mc-font-display);
    font-weight: 400;
    letter-spacing: 1px;
    line-height: 1.2;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--mc-text-ink);
  }
  .rule {
    flex: 1;
    height: 2px;
    background: var(--mc-fill-ink);
  }
`;
