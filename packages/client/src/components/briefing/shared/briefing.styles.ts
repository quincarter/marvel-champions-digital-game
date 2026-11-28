import { css } from "lit";

/**
 * The type every Briefing element shares, from the panel layer's design tokens: the small tracked capitals line
 * (`typeRole.label`), the body and row-title faces, and Bangers. A size that grows on desktop is `var(--mc-small-N)`.
 */
export const BriefingTextStyles = css`
  .label {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    line-height: 1.2;
    text-transform: uppercase;
  }
  .body {
    font-size: var(--mc-small-11);
    line-height: 1.45;
    opacity: 0.75;
  }
  .row-title {
    font-weight: 800;
    font-size: var(--mc-small-11);
    line-height: 1.25;
  }
  .display {
    font-family: var(--mc-font-display);
    font-weight: 400;
    letter-spacing: 1px;
    line-height: 0.95;
    text-transform: uppercase;
  }
  .red {
    color: var(--mc-text-red);
  }
  .cost {
    color: var(--mc-text-cost);
  }
  .heal {
    color: var(--mc-text-heal);
  }
`;

/** A column of blocks a section is made of: a 4px gap, as the old paragraphs stacked. */
export const BriefingStackStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
`;

/** The look the Briefing own pressable parts share (the `McPress` subclasses): a block, pointer cursor on a focus stop, no text selection. */
export const BriefingPressStyles = css`
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
  :host([data-stop]:not([data-stop=""])) {
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
`;
