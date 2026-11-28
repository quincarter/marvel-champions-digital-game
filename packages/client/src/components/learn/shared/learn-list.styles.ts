import { css } from "lit";

/** The look the hub's lists share: a small capitals label over a stack of rows. */
export const LearnListStyles = css`
  :host {
    display: block;
    min-width: 0;
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
  }
  .label {
    margin-bottom: 8px;
    font-size: var(--mc-small-9, 9px);
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .rows {
    display: grid;
    gap: 10px;
  }
`;
