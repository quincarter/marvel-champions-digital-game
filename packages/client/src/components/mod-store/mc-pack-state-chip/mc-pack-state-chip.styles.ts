import { css } from "lit";

export const McPackStateChipStyles = css`
  :host {
    display: inline-block;
    max-width: 100%;
  }
  .chip {
    display: block;
    padding: 4px 7px;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
  }
  :host([solid]) .chip {
    background: var(--mc-fill-red);
    color: var(--mc-text-paper);
    outline: none;
  }
`;
