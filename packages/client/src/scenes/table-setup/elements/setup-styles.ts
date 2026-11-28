/** The look the Set up the table elements share, from the panel layer's design tokens (dark mode follows the variables). */
import { css } from "lit";

export const SetupBaseStyles = css`
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
  :host([data-stop]) {
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  /* A name in Bangers, shrunk by its owner's width rather than wrapped. */
  .name {
    font-family: var(--mc-font-display);
    text-transform: uppercase;
    font-size: var(--name-size, 15px);
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The small capitals line: counts, labels. */
  .label {
    font-size: var(--mc-small-10, 10px);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.7;
    line-height: 1.2;
  }
  .meta {
    font-size: 13px;
    line-height: 1.2;
    opacity: 0.8;
  }
  .scroller {
    overflow-y: auto;
    overflow-x: clip;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
`;

/** A white card: a thin ink outline, or a 4px Hero Red border when chosen. Never a fill (red is spent on Deal). */
export const CardFrameStyles = css`
  .frame {
    background: var(--mc-fill-card);
    border: 1.5px solid color-mix(in srgb, var(--mc-line-ink) 70%, transparent);
    position: relative;
  }
  :host([selected]) .frame,
  .frame.selected {
    border: 4px solid var(--mc-fill-red);
  }
  :host([dim]) .inner {
    opacity: 0.45;
  }
`;
