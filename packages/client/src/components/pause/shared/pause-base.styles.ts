import { css } from "lit";

/** The look Pause's elements share, from the panel layer's design tokens (dark mode follows the variables). */
export const PauseBaseStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    font-family: var(--mc-font-body);
    -webkit-font-smoothing: antialiased;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  :host([data-stop]) {
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  /* A small capitals label. */
  .label {
    font-size: var(--mc-small-11, 11px);
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .scroller {
    overflow-y: auto;
    overflow-x: clip;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
`;
