import { css } from "lit";

export const McSeatsHintsStyles = css`
  :host {
    display: block;
    min-width: 0;
    color: var(--mc-text-ink);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 18px;
    min-height: 26px;
  }
  .heading {
    margin: 0;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .word {
    font-family: var(--mc-font-body);
    font-weight: 700;
    font-size: var(--mc-small-11);
    letter-spacing: 1px;
    text-transform: uppercase;
    opacity: 0.85;
  }
`;
