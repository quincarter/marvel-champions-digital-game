import { css } from "lit";

/**
 * The host is as wide as the glyph is open: it narrows (cells kept at their size, cut off on the right) and fades
 * as the mouse moves, and comes back when it rests. Durations and easing are set by the element (the Phaser glyph's
 * 140ms close and 180ms open, ease-out quadratic). Each cell is its own inline svg in a row.
 */
export const McGlyphStyles = css`
  :host {
    display: block;
    overflow: hidden;
    pointer-events: none;
    transition-property: width, opacity;
    transition-timing-function: cubic-bezier(0.5, 1, 0.89, 1);
  }
  :host([still]) {
    transition: none;
  }
  @media (prefers-reduced-motion: reduce) {
    :host {
      transition: none;
    }
  }
  .row {
    display: flex;
    align-items: center;
    height: 100%;
    gap: 4px;
  }
  svg {
    display: block;
    flex: none;
    overflow: visible;
  }
  text {
    font-family: var(--mc-font-body);
    font-weight: 800;
    text-anchor: middle;
    dominant-baseline: central;
    fill: var(--mc-text-ink);
  }
`;
