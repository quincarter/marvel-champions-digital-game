import { css } from "lit";

/** The look the deck builder's elements share, from the panel layer's design tokens (dark mode follows the variables). */
export const BuilderBaseStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    font-family: var(--mc-font-body);
    color: inherit;
    -webkit-font-smoothing: antialiased;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  /* The small capital label over a control group. */
  .label {
    font-size: var(--mc-small-10, 10px);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.6;
    line-height: 1.2;
    margin: 0 0 6px;
  }
  .note {
    font-size: var(--mc-small-11, 11px);
    line-height: 1.35;
    opacity: 0.75;
  }
  [data-stop],
  :host([data-stop]) {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  :host([data-stop]) {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
`;
