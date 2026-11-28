/** The look Your stats' elements share, from the panel layer's design tokens (dark mode follows the variables). */
import { css } from "lit";

export const StatsBaseStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
    -webkit-font-smoothing: antialiased;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  /* A name in Bangers. */
  .display {
    font-family: var(--mc-font-display);
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 1;
  }
  /* The small capitals line: a caption over a figure. */
  .caption {
    font-size: var(--mc-small-11, 11px);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1.2;
  }
  .body {
    font-size: 13px;
    line-height: 1.3;
    opacity: 0.9;
  }
  .clip {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
